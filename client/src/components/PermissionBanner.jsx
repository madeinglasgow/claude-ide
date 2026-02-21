import React from 'react';

export default function PermissionBanner({ request, onAllow, onDeny }) {
  const { toolName, input } = request;

  let summary = toolName;
  if (toolName === 'Bash' && input?.command) {
    summary = `Run: ${input.command.slice(0, 80)}`;
  } else if (toolName === 'Write' && input?.file_path) {
    summary = `Write to: ${input.file_path}`;
  } else if (toolName === 'Edit' && input?.file_path) {
    summary = `Edit: ${input.file_path}`;
  }

  return (
    <div className="permission-banner">
      <div className="permission-info">
        <span className="permission-label">Permission needed</span>
        <span className="permission-summary">{summary}</span>
      </div>
      <div className="permission-actions">
        <button className="permission-btn allow" onClick={onAllow}>Allow</button>
        <button className="permission-btn deny" onClick={onDeny}>Deny</button>
      </div>
    </div>
  );
}
