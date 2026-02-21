import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function MessageInput({ onSend, disabled, isGenerating, onInterrupt }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (isGenerating) {
      onInterrupt();
      return;
    }
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }, [text, disabled, isGenerating, onSend, onInterrupt]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="message-input-container">
      <textarea
        ref={textareaRef}
        className="message-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Connecting...' : 'Message Claude...'}
        disabled={disabled}
        rows={1}
      />
      <button
        className={`message-send-btn${isGenerating ? ' interrupt' : ''}`}
        onClick={handleSubmit}
        disabled={disabled || (!isGenerating && !text.trim())}
      >
        {isGenerating ? 'Stop' : 'Send'}
      </button>
    </div>
  );
}
