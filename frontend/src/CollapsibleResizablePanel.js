import React, { useRef, useState } from 'react';
import TerminalPanel from './TerminalPanel';

function CollapsibleResizablePanel({ children, initialHeight = 180, minHeight = 80, maxHeight = 400, collapsedHeight = 0, isCollapsed, onToggleCollapse }) {
  const [height, setHeight] = useState(initialHeight);
  const dragging = useRef(false);

  const onMouseDown = (e) => {
    dragging.current = true;
    document.body.style.cursor = 'ns-resize';
  };

  const onMouseMove = (e) => {
    if (!dragging.current || isCollapsed) return;
    setHeight((prevHeight) => {
      let newHeight = prevHeight - e.movementY;
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;
      return newHeight;
    });
  };

  const onMouseUp = () => {
    dragging.current = false;
    document.body.style.cursor = '';
  };

  React.useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });

  React.useEffect(() => {
    if (isCollapsed) setHeight(collapsedHeight);
    else if (height < minHeight) setHeight(minHeight);
  }, [isCollapsed]);

  return (
    <div style={{ width: '100%', background: '#181926', position: 'relative', userSelect: dragging.current ? 'none' : 'auto' }}>
      <div
        style={{
          height: 7,
          cursor: 'ns-resize',
          background: '#23233a',
          borderTop: '1.5px solid #23233a',
          borderBottom: '1.5px solid #23233a',
          width: '100%',
          zIndex: 100,
          display: isCollapsed ? 'none' : 'block',
        }}
        onMouseDown={onMouseDown}
      >
        <div style={{ width: 40, height: 3, background: '#353b45', borderRadius: 3, margin: '2px auto' }} />
      </div>
      <div style={{ height: isCollapsed ? collapsedHeight : height, minHeight: isCollapsed ? collapsedHeight : minHeight, maxHeight, transition: 'height 0.1s', overflow: 'hidden', background: '#181926', position: 'relative' }}>
        <button
          onClick={onToggleCollapse}
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            zIndex: 101,
            background: '#23233a',
            color: '#7fd',
            border: 'none',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 13,
            cursor: 'pointer',
            opacity: 0.8,
          }}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
        <div style={{ height: '100%', width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleResizablePanel;
