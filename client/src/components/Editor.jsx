import React, { useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { keymap } from '@codemirror/view';

export default function Editor({ content, onChange, onSave }) {
  // Global keyboard shortcut as fallback
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        onSave();
        return true;
      },
    },
  ]);

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <CodeMirror
        value={content}
        height="100%"
        theme="light"
        extensions={[markdown(), saveKeymap]}
        onChange={onChange}
        style={{ height: '100%' }}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          bracketMatching: true,
          indentOnInput: true,
        }}
      />
    </div>
  );
}
