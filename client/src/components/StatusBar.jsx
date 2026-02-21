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

const PERMISSION_MODE_LABELS = {
  bypassPermissions: 'Auto-allow all',
  acceptEdits: 'Prompt for bash',
  default: 'Prompt for all',
};

export default function StatusBar({ status, permissionMode, onPermissionModeChange, onInterrupt, onNewSession }) {
  const label = STATUS_LABELS[status] || status;
  const isActive = status === 'thinking' || status === 'streaming' || status === 'tool_executing';

  return (
    <div className="status-bar">
      <div className="status-indicator">
        <span className={`status-dot${isActive ? ' active' : ''}${status === 'error' ? ' error' : ''}`} />
        <span className="status-label">{label}</span>
      </div>
      <div className="status-actions">
        <select
          className="permission-mode-select"
          value={permissionMode}
          onChange={(e) => onPermissionModeChange(e.target.value)}
          title="Tool permission mode"
        >
          <option value="bypassPermissions">{PERMISSION_MODE_LABELS.bypassPermissions}</option>
          <option value="acceptEdits">{PERMISSION_MODE_LABELS.acceptEdits}</option>
          <option value="default">{PERMISSION_MODE_LABELS.default}</option>
        </select>
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
