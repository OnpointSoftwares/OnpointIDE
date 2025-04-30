import React, { useRef, useState } from 'react';
import TerminalPanel from './TerminalPanel';

function ResizableTerminal({ visible = true }) {
  const [height, setHeight] = useState(180);
  const dragging = useRef(false);

  const onMouseDown = (e) => {
    dragging.current = true;
    document.body.style.cursor = 'ns-resize';
  };

  const onMouseMove = (e) => {
    if (!dragging.current) return;
    setHeight((prevHeight) => {
      let newHeight = prevHeight - e.movementY;
      if (newHeight < 80) newHeight = 80;
      if (newHeight > 400) newHeight = 400;
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
        }}
        onMouseDown={onMouseDown}
      >
        <div style={{ width: 40, height: 3, background: '#353b45', borderRadius: 3, margin: '2px auto' }} />
      </div>
      <div style={{ height, minHeight: 80, maxHeight: 400, transition: 'height 0.1s', overflow: 'hidden', background: '#181926' }}>
        <TerminalPanel visible={visible} />
      </div>
    </div>
  );
}

export default ResizableTerminal;
