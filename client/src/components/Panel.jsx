import React from 'react';

export default function Panel({ title, collapsed, onToggle, actions, children }) {
  return (
    <>
      <div className="panel-header">
        <span>{title}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {actions}
          <button onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>
      {!collapsed && <div className="panel-content">{children}</div>}
    </>
  );
}
