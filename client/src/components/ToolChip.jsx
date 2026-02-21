import React, { useState } from 'react';

const TOOL_ICONS = {
  Read: '\u{1F4C4}',
  Write: '\u{270F}\u{FE0F}',
  Edit: '\u{270F}\u{FE0F}',
  Bash: '\u{1F4BB}',
  Glob: '\u{1F50D}',
  Grep: '\u{1F50E}',
  WebFetch: '\u{1F310}',
  WebSearch: '\u{1F310}',
  Task: '\u{1F9E9}',
  TodoWrite: '\u{2705}',
  AskUserQuestion: '\u{2753}',
};

function getToolDetail(name, input) {
  if (!input) return '';
  switch (name) {
    case 'Read':
      return input.file_path ? input.file_path.split('/').pop() : '';
    case 'Write':
      return input.file_path ? input.file_path.split('/').pop() : '';
    case 'Edit':
      return input.file_path ? input.file_path.split('/').pop() : '';
    case 'Bash':
      return input.command ? input.command.slice(0, 60) : '';
    case 'Glob':
      return input.pattern || '';
    case 'Grep':
      return input.pattern || '';
    case 'WebSearch':
      return input.query || '';
    case 'WebFetch':
      return input.url || '';
    default:
      return '';
  }
}

export default function ToolChip({ name, input, id }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[name] || '\u{1F527}';
  const detail = getToolDetail(name, input);

  return (
    <div className="tool-chip-wrapper">
      <button
        className={`tool-chip${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="tool-chip-icon">{icon}</span>
        <span className="tool-chip-name">{name}</span>
        {detail && <span className="tool-chip-detail">{detail}</span>}
        <span className="tool-chip-chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && input && (
        <div className="tool-chip-expansion">
          {name === 'Bash' && input.command ? (
            <div className="bash-terminal">
              <div className="bash-terminal-header">
                <span className="bash-dot red" />
                <span className="bash-dot yellow" />
                <span className="bash-dot green" />
                <span className="bash-terminal-title">bash</span>
              </div>
              <pre className="bash-terminal-body">$ {input.command}</pre>
            </div>
          ) : (
            <pre className="tool-expansion-json">{JSON.stringify(input, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
