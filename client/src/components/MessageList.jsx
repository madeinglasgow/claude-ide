import React, { useRef, useEffect, useState } from 'react';
import MessageCard from './MessageCard';

export default function MessageList({ messages, status }) {
  const containerRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, userScrolledUp]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setUserScrolledUp(!atBottom);
  }

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      {messages.length === 0 && status !== 'connecting' && (
        <div className="message-list-empty">
          <div className="empty-icon">&#9672;</div>
          <div>Start a conversation with Claude</div>
          <div className="empty-hint">Ask Claude to write code, read files, or run commands in your workspace.</div>
        </div>
      )}
      {messages.map((msg) => (
        <MessageCard key={msg.id} message={msg} />
      ))}
      {(status === 'thinking') && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="thinking-indicator">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </div>
      )}
    </div>
  );
}
