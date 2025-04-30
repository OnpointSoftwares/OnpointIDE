import React from 'react';

function Breadcrumbs({ filePath }) {
  if (!filePath) return null;
  const parts = filePath.split('/').filter(Boolean);
  return (
    <nav aria-label="breadcrumb" style={{ margin: '12px 0', color: '#b5b5c2' }}>
      <ol className="breadcrumb" style={{ background: 'transparent', padding: 0, margin: 0 }}>
        {parts.map((part, idx) => (
          <li
            key={idx}
            className="breadcrumb-item"
            style={{
              color: idx === parts.length - 1 ? '#fff' : '#b5b5c2',
              fontWeight: idx === parts.length - 1 ? 'bold' : 'normal',
              fontSize: 15,
              background: 'transparent',
              display: 'inline',
            }}
          >
            {part}
            {idx < parts.length - 1 && <span style={{ margin: '0 6px', color: '#444' }}>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
