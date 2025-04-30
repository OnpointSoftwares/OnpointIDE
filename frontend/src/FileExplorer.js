import React, { useState, useEffect } from 'react';

// Example file structure
const initialTree = [
  {
    type: 'folder',
    name: 'src',
    children: [
      { type: 'file', name: 'App.js' },
      { type: 'file', name: 'CodeEditor.js' },
      { type: 'file', name: 'SuggestionsPanel.js' },
      { type: 'file', name: 'api.js' },
      { type: 'file', name: 'index.js' }
    ]
  },
  {
    type: 'folder',
    name: 'public',
    children: [
      { type: 'file', name: 'index.html' }
    ]
  },
  { type: 'file', name: 'package.json' },
  { type: 'file', name: 'README.md' }
];

function FileNode({ node, onFileClick, openFiles, setOpenFiles, path = '', level = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const fullPath = path ? `${path}/${node.name}` : node.name;
  const isDir = node.isDir || node.type === 'folder';

  // Keyboard navigation: Enter to open, ArrowRight/Left to expand/collapse
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (isDir) setExpanded((exp) => !exp);
      else onFileClick(fullPath, node.handle);
    }
    if (isDir) {
      if (e.key === 'ArrowRight') setExpanded(true);
      if (e.key === 'ArrowLeft') setExpanded(false);
    }
  };

  if (isDir) {
    return (
      <div>
        <div
          className={`explorer-item explorer-folder`}
          style={{ paddingLeft: 24 + level * 16 }}
          tabIndex={0}
          onClick={() => setExpanded((e) => !e)}
          onKeyDown={handleKeyDown}
        >
          <span className="explorer-icon" aria-label={expanded ? 'Open folder' : 'Closed folder'}>{expanded ? '📂' : '📁'}</span>
          {node.name}
        </div>
        {expanded && (
          <div>
            {node.children && node.children.map((child) => (
              <FileNode
                key={child.name + child.path}
                node={child}
                path={fullPath}
                onFileClick={onFileClick}
                openFiles={openFiles}
                setOpenFiles={setOpenFiles}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className={`explorer-item${openFiles === fullPath ? ' selected' : ''}`}
      style={{ paddingLeft: 24 + level * 16 }}
      tabIndex={0}
      onClick={() => onFileClick(fullPath, node.handle)}
      onKeyDown={handleKeyDown}
    >
      <span className="explorer-icon" aria-label="File">📝</span>
      {node.name}
    </div>
  );
}

function FileExplorer({ files = initialTree, onFileClick, openFiles, setOpenFiles }) {
  // Support both array and root-object tree
  const tree = Array.isArray(files) ? files : (files.children || []);

  return (
    <div className="FileExplorer bg-dark text-light panel-shadow" style={{ height: '100%', padding: 12, borderRadius: 8, width: 250, borderRight: '1px solid #353b45', overflowY: 'auto', background: '#1e1e2f', color: '#d4d4d4' }}>
      <h6 className="mb-3" style={{ color: '#d4d4d4', marginLeft: 16 }}>Explorer</h6>
      {tree.map((node) => (
        <FileNode
          key={node.name + node.path}
          node={node}
          onFileClick={onFileClick}
          openFiles={openFiles}
          setOpenFiles={setOpenFiles}
        />
      ))}
    </div>
  );
}

export default FileExplorer;
