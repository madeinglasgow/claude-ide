import React from 'react';
import ToolChip from './ToolChip';

export default function MessageCard({ message }) {
  const { role, content, streaming } = message;

  if (role === 'system' && message.type === 'error') {
    return (
      <div className="message-card message-error">
        <div className="message-content">{message.text}</div>
      </div>
    );
  }

  return (
    <div className={`message-card message-${role}`}>
      <div className="message-role-badge">{role === 'user' ? 'You' : 'Claude'}</div>
      <div className="message-content">
        {content && content.map((block, i) => renderBlock(block, i, streaming))}
      </div>
    </div>
  );
}

function renderBlock(block, index, streaming) {
  switch (block.type) {
    case 'text':
      return (
        <div key={index} className="message-text">
          {formatText(block.text)}
          {streaming && <span className="streaming-cursor" />}
        </div>
      );

    case 'thinking':
      return (
        <div key={index} className="message-thinking">
          <details>
            <summary>Thinking...</summary>
            <pre>{block.thinking}</pre>
          </details>
        </div>
      );

    case 'tool_use':
      return <ToolChip key={index} name={block.name} input={block.input} id={block.id} />;

    case 'tool_result':
      return (
        <div key={index} className="tool-result">
          <div className="tool-result-content">
            {typeof block.content === 'string'
              ? block.content.slice(0, 500)
              : JSON.stringify(block.content)?.slice(0, 500)}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function formatText(text) {
  if (!text) return null;

  // Split on code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (match) {
        return (
          <pre key={i} className="code-block">
            {match[2]}
          </pre>
        );
      }
    }

    // Inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((p, j) => {
          if (p.startsWith('`') && p.endsWith('`')) {
            return <code key={j} className="inline-code">{p.slice(1, -1)}</code>;
          }
          return p;
        })}
      </span>
    );
  });
}
