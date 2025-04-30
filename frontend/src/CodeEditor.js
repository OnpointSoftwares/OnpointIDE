import React from 'react';
import MonacoEditor from '@monaco-editor/react';

function CodeEditor({ code, onChange }) {
  return (
    <div style={{ border: '1.5px solid #23233a', borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e2f' }} className="CodeEditor bg-dark text-light">
      <MonacoEditor
        height="100%"
        width="100%"
        defaultLanguage="python"
        theme="vs-dark"
        value={code}
        onChange={onChange}
        options={{
          fontSize: 15,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
        }}
      />
    </div>
  );
}

export default CodeEditor;
