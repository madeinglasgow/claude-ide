import { useState, useRef, useCallback, useEffect } from 'react';

// Status: 'connecting' | 'idle' | 'thinking' | 'streaming' | 'tool_executing' | 'waiting_permission' | 'error'

export default function useConversation() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [sessionId, setSessionId] = useState(null);
  const [permissionRequest, setPermissionRequest] = useState(null);
  const [permissionMode, setPermissionMode] = useState('bypassPermissions');
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // Streaming state: accumulate content blocks for current assistant turn
  const streamingRef = useRef({
    blocks: {},       // blockIndex -> { type, text, ... }
    currentMessage: null,
  });

  function send(msg) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/conversation`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('idle');
      // Resume session if we have one stored
      const stored = localStorage.getItem('claude-ide-session');
      if (stored) {
        setSessionId(stored);
        send({ type: 'resume_session', sessionId: stored });
      }
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleServerMessage(msg);
    };

    ws.onclose = () => {
      setStatus('connecting');
      // Auto-reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'session_init':
        setSessionId(msg.sessionId);
        localStorage.setItem('claude-ide-session', msg.sessionId);
        break;

      case 'status':
        setStatus(msg.state);
        break;

      case 'stream_event':
        handleStreamEvent(msg.event, msg.parentToolUseId);
        break;

      case 'assistant_message':
        // Full assistant message — finalize any streaming state
        finalizeStreamingMessage(msg.message, msg.parentToolUseId);
        break;

      case 'permission_request':
        setPermissionRequest({
          requestId: msg.requestId,
          toolName: msg.toolName,
          input: msg.input,
        });
        setStatus('waiting_permission');
        break;

      case 'permission_mode':
        setPermissionMode(msg.mode);
        break;

      case 'result':
        setStatus('idle');
        // Optionally store result metadata
        break;

      case 'error':
        setStatus('error');
        setMessages((prev) => [
          ...prev,
          { role: 'system', type: 'error', text: msg.message, id: Date.now() },
        ]);
        break;

      default:
        break;
    }
  }

  function handleStreamEvent(event, parentToolUseId) {
    if (!event) return;

    switch (event.type) {
      case 'message_start':
        // New assistant message starting
        streamingRef.current = { blocks: {}, currentMessage: null };
        setStatus('streaming');
        break;

      case 'content_block_start': {
        const idx = event.index;
        const block = event.content_block;
        streamingRef.current.blocks[idx] = { ...block, text: block.text || '' };

        if (block.type === 'tool_use') {
          setStatus('tool_executing');
          // Add a streaming tool-use placeholder
          updateStreamingMessage(parentToolUseId);
        }
        break;
      }

      case 'content_block_delta': {
        const idx = event.index;
        const delta = event.delta;
        const block = streamingRef.current.blocks[idx];
        if (!block) break;

        if (delta.type === 'text_delta') {
          block.text = (block.text || '') + delta.text;
        } else if (delta.type === 'input_json_delta') {
          block.partial_json = (block.partial_json || '') + delta.partial_json;
        } else if (delta.type === 'thinking_delta') {
          block.thinking = (block.thinking || '') + delta.thinking;
        }

        updateStreamingMessage(parentToolUseId);
        break;
      }

      case 'content_block_stop': {
        const idx = event.index;
        const block = streamingRef.current.blocks[idx];
        if (block && block.type === 'tool_use' && block.partial_json) {
          try {
            block.input = JSON.parse(block.partial_json);
          } catch {
            block.input = {};
          }
          delete block.partial_json;
        }
        updateStreamingMessage(parentToolUseId);
        break;
      }

      case 'message_stop':
        // Message complete — assistant_message event will follow
        break;

      default:
        break;
    }
  }

  function updateStreamingMessage(parentToolUseId) {
    const blocks = Object.values(streamingRef.current.blocks);
    const content = blocks.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking || '' };
      if (b.type === 'tool_use') {
        let input = b.input || {};
        if (b.partial_json) {
          try { input = JSON.parse(b.partial_json); } catch { /* incomplete */ }
        }
        return { type: 'tool_use', id: b.id, name: b.name, input };
      }
      return b;
    });

    setMessages((prev) => {
      // Find or create the streaming assistant message
      const streamId = 'streaming';
      const existing = prev.findIndex((m) => m.id === streamId);
      const msg = {
        id: streamId,
        role: 'assistant',
        content,
        streaming: true,
        parentToolUseId,
      };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = msg;
        return updated;
      }
      return [...prev, msg];
    });
  }

  function finalizeStreamingMessage(apiMessage, parentToolUseId) {
    setMessages((prev) => {
      // Replace the streaming placeholder with the final message
      const filtered = prev.filter((m) => m.id !== 'streaming');
      return [
        ...filtered,
        {
          id: `assistant-${Date.now()}-${Math.random()}`,
          role: 'assistant',
          content: apiMessage.content || [],
          streaming: false,
          parentToolUseId,
        },
      ];
    });
    streamingRef.current = { blocks: {}, currentMessage: null };
  }

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;

    // Add user message to local state
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: [{ type: 'text', text }] },
    ]);

    send({ type: 'user_message', text });
    setStatus('thinking');
  }, []);

  const respondPermission = useCallback((requestId, behavior, message) => {
    send({
      type: 'permission_response',
      requestId,
      behavior,
      message,
    });
    setPermissionRequest(null);
    setStatus('tool_executing');
  }, []);

  const interrupt = useCallback(() => {
    send({ type: 'interrupt' });
    setStatus('idle');
  }, []);

  const changePermissionMode = useCallback((mode) => {
    send({ type: 'set_permission_mode', mode });
  }, []);

  const newSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('claude-ide-session');
    streamingRef.current = { blocks: {}, currentMessage: null };
    setPermissionRequest(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    messages,
    status,
    sessionId,
    permissionRequest,
    permissionMode,
    sendMessage,
    respondPermission,
    interrupt,
    newSession,
    changePermissionMode,
  };
}
