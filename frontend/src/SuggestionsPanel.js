import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import { v4 as uuidv4 } from 'uuid';

function SuggestionsPanel({ suggestions, onAccept, onReject }) {
  if (!suggestions.length) {
    return <div className="text-muted">No suggestions yet.</div>;
  }

  const editorOptions = {
    selectOnLineNumbers: true,
    readOnly: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    fontSize: 14,
  };

  return (
    <div>
      <h5>Gemini Suggestions</h5>
      {suggestions.map((sugg) => (
        <div key={uuidv4()} className="card mb-3">
          <div className="card-body">
            <div style={{ height: '300px', marginBottom: '10px' }}>
              <MonacoEditor
                language="javascript" // or any other language depending on the suggestion
                value={sugg.text}
                options={editorOptions}
              />
            </div>
            {sugg.reason && (
              <div className="text-secondary mb-2"><small>{sugg.reason}</small></div>
            )}
            <button className="btn btn-success btn-sm me-2" onClick={() => onAccept(sugg)}>
              Accept
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => onReject(sugg)}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
export default SuggestionsPanel;
