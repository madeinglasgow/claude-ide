import React from 'react';

const STATUS_LABELS = {
  connecting: 'Connecting...',
  idle: 'Ready',
  thinking: 'Thinking...',
  streaming: 'Responding...',
  tool_executing: 'Running tool...',
  waiting_permission: 'Waiting for approval',
  error: 'Error',
};

export default function StatusBar({ status, onInterrupt, onNewSession }) {
  const label = STATUS_LABELS[status] || status;
  const isActive = status === 'thinking' || status === 'streaming' || status === 'tool_executing';

  return (
    <div className="status-bar">
      <div className="status-indicator">
        <span className={`status-dot${isActive ? ' active' : ''}${status === 'error' ? ' error' : ''}`} />
        <span className="status-label">{label}</span>
      </div>
      <div className="status-actions">
        {isActive && (
          <button className="status-action-btn" onClick={onInterrupt}>Stop</button>
        )}
        <button className="status-action-btn" onClick={onNewSession} title="New conversation">
          + New
        </button>
      </div>
    </div>
  );
}
