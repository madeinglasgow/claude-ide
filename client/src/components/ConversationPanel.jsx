import React from 'react';
import useConversation from '../hooks/useConversation';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import StatusBar from './StatusBar';
import PermissionBanner from './PermissionBanner';

export default function ConversationPanel() {
  const {
    messages,
    status,
    sessionId,
    permissionRequest,
    sendMessage,
    respondPermission,
    interrupt,
    newSession,
  } = useConversation();

  const isGenerating = status === 'thinking' || status === 'streaming' || status === 'tool_executing';

  return (
    <div className="conversation-panel">
      <MessageList messages={messages} status={status} />

      {permissionRequest && (
        <PermissionBanner
          request={permissionRequest}
          onAllow={() => respondPermission(permissionRequest.requestId, 'allow')}
          onDeny={() => respondPermission(permissionRequest.requestId, 'deny', 'Denied by user')}
        />
      )}

      <div className="conversation-footer">
        <StatusBar status={status} onInterrupt={interrupt} onNewSession={newSession} />
        <MessageInput
          onSend={sendMessage}
          disabled={status === 'connecting' || status === 'waiting_permission'}
          isGenerating={isGenerating}
          onInterrupt={interrupt}
        />
      </div>
    </div>
  );
}
