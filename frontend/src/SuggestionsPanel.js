import React from 'react';

function SuggestionsPanel({ suggestions, onAccept, onReject }) {
  if (!suggestions.length) {
    return <div className="text-muted">No suggestions yet.</div>;
  }
  return (
    <div>
      <h5>Gemini Suggestions</h5>
      {suggestions.map((sugg) => (
        <div key={sugg.id} className="card mb-3">
          <div className="card-body">
            <pre className="bg-light p-2 rounded"><code>{sugg.diff}</code></pre>
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
