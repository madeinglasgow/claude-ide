const { query } = require('@anthropic-ai/claude-code');
const path = require('path');

function attachConversation(ws) {
  const cwd = path.resolve(process.env.WORKSPACE_DIR || './workspace');

  let sessionId = null;
  let abortController = null;
  let activeQuery = null;
  let messageGenerator = null;
  let messageResolve = null;
  let closed = false;
  let currentPermissionMode = 'bypassPermissions'; // 'bypassPermissions' | 'acceptEdits' | 'default'

  function send(msg) {
    if (!closed && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }

  // Async generator that yields user messages on demand
  async function* userMessageStream(firstPrompt) {
    // Yield the first message
    yield {
      type: 'user',
      message: { role: 'user', content: firstPrompt },
    };

    // Then wait for subsequent messages
    while (!closed) {
      const text = await new Promise((resolve) => {
        messageResolve = resolve;
      });
      messageResolve = null;
      if (text === null) break; // signal to end
      yield {
        type: 'user',
        message: { role: 'user', content: text },
      };
    }
  }

  // Permission request handling via WebSocket
  const pendingPermissions = new Map();
  let permissionRequestId = 0;

  async function canUseTool(toolName, input, { signal }) {
    // Auto-allow based on current permission mode
    if (currentPermissionMode === 'bypassPermissions') {
      return { behavior: 'allow', updatedInput: input };
    }
    if (currentPermissionMode === 'acceptEdits') {
      const autoAllow = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebSearch', 'WebFetch'];
      if (autoAllow.includes(toolName)) {
        return { behavior: 'allow', updatedInput: input };
      }
    }

    // Prompt the user
    const requestId = String(++permissionRequestId);

    send({
      type: 'permission_request',
      requestId,
      toolName,
      input,
    });

    return new Promise((resolve) => {
      pendingPermissions.set(requestId, resolve);

      // Clean up if aborted
      if (signal) {
        signal.addEventListener('abort', () => {
          pendingPermissions.delete(requestId);
          resolve({ behavior: 'deny', message: 'Aborted' });
        }, { once: true });
      }
    });
  }

  async function startQuery(prompt, resumeSessionId) {
    abortController = new AbortController();

    const options = {
      abortController,
      cwd,
      includePartialMessages: true,
      canUseTool,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `\nYou are working in the Claude IDE. The user's workspace is at ${cwd}.\n`,
      },
      tools: { type: 'preset', preset: 'claude_code' },
    };

    if (resumeSessionId) {
      options.resume = resumeSessionId;
    }

    // Use streaming input mode for multi-turn within a single query
    const promptInput = resumeSessionId
      ? userMessageStream(prompt)
      : (messageGenerator
          ? userMessageStream(prompt)
          : prompt);

    // For the first message, if not resuming, use string prompt
    // For subsequent messages or resume, use the generator
    const queryInput = resumeSessionId
      ? { prompt: userMessageStream(prompt), options }
      : { prompt, options };

    try {
      activeQuery = query(queryInput);

      for await (const message of activeQuery) {
        if (closed) break;

        switch (message.type) {
          case 'system':
            if (message.subtype === 'init') {
              sessionId = message.session_id;
              send({
                type: 'session_init',
                sessionId: message.session_id,
                model: message.model,
                tools: message.tools,
              });
            }
            break;

          case 'assistant':
            send({
              type: 'assistant_message',
              message: message.message,
              parentToolUseId: message.parent_tool_use_id,
            });
            break;

          case 'stream_event':
            // Forward raw streaming events for live rendering
            send({
              type: 'stream_event',
              event: message.event,
              parentToolUseId: message.parent_tool_use_id,
            });
            break;

          case 'result':
            send({
              type: 'result',
              sessionId: message.session_id,
              subtype: message.subtype,
              result: message.result,
              cost: message.total_cost_usd,
              duration: message.duration_ms,
              numTurns: message.num_turns,
              isError: message.is_error,
            });
            break;

          default:
            // Forward other message types as-is
            send({ type: 'sdk_message', sdkType: message.type, data: message });
            break;
        }
      }

      send({ type: 'status', state: 'idle' });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Conversation error:', err);
        // If resume failed, clear sessionId and retry as new session
        if (resumeSessionId && err.message.includes('exited with code')) {
          console.log('Resume failed, starting fresh session');
          sessionId = null;
          send({ type: 'error', message: 'Session expired, starting fresh...' });
          send({ type: 'status', state: 'idle' });
          startQuery(prompt);
          return;
        }
        send({ type: 'error', message: err.message });
      }
      send({ type: 'status', state: 'idle' });
    }

    activeQuery = null;
    abortController = null;
  }

  // Handle multi-turn: send follow-up message to running query
  function sendFollowUp(text) {
    if (messageResolve) {
      messageResolve(text);
    } else {
      // No active generator - start a new query with resume
      if (sessionId) {
        startQuery(text, sessionId);
      } else {
        startQuery(text);
      }
    }
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'user_message':
        send({ type: 'status', state: 'thinking' });
        if (activeQuery && messageResolve) {
          // Multi-turn: feed into running generator
          sendFollowUp(msg.text);
        } else if (sessionId) {
          // Resume existing session
          startQuery(msg.text, sessionId);
        } else {
          // Brand new session
          startQuery(msg.text);
        }
        break;

      case 'resume_session':
        sessionId = msg.sessionId;
        send({ type: 'status', state: 'idle' });
        break;

      case 'permission_response': {
        const resolve = pendingPermissions.get(msg.requestId);
        if (resolve) {
          pendingPermissions.delete(msg.requestId);
          if (msg.behavior === 'allow') {
            // Pass through the original input (client doesn't modify it)
            resolve({ behavior: 'allow', updatedInput: msg.originalInput || {} });
          } else {
            resolve({ behavior: 'deny', message: msg.message || 'Denied by user' });
          }
        }
        break;
      }

      case 'set_permission_mode': {
        const valid = ['bypassPermissions', 'acceptEdits', 'default'];
        if (valid.includes(msg.mode)) {
          currentPermissionMode = msg.mode;
          // Tell the subprocess to reset its cached permissions
          // Use 'default' for the subprocess when we want to handle it ourselves
          if (activeQuery && activeQuery.setPermissionMode) {
            const subprocessMode = msg.mode === 'bypassPermissions' ? 'default' : msg.mode;
            activeQuery.setPermissionMode(subprocessMode).catch((err) => {
              console.error('Failed to set permission mode:', err);
            });
          }
          send({ type: 'permission_mode', mode: currentPermissionMode });
        }
        break;
      }

      case 'interrupt':
        if (abortController) {
          abortController.abort();
        }
        if (activeQuery && activeQuery.interrupt) {
          activeQuery.interrupt().catch(() => {});
        }
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    closed = true;
    if (messageResolve) {
      messageResolve(null);
    }
    if (abortController) {
      abortController.abort();
    }
  });

  // Send ready message
  send({ type: 'status', state: 'idle' });
  send({ type: 'permission_mode', mode: currentPermissionMode });
}

module.exports = { attachConversation };
