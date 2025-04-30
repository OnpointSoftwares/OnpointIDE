import React, { useState, useRef, useEffect } from 'react';

function Tooltip({ children, content, placement = 'top', delay = 350 }) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState({});
  const timeout = useRef();
  const nodeRef = useRef();

  const show = () => {
    timeout.current = setTimeout(() => {
      // Defer visibility and style update to next frame
      window.requestAnimationFrame(() => {
        setVisible(true);
        setStyle(getTooltipStyle());
      });
    }, delay);
  };
  const hide = () => {
    clearTimeout(timeout.current);
    setVisible(false);
  };

  // Positioning
  const getTooltipStyle = () => {
    if (!nodeRef.current) return {};
    const rect = nodeRef.current.getBoundingClientRect();
    let style = { position: 'fixed', zIndex: 9999 };
    if (placement === 'top') {
      style.left = rect.left + rect.width / 2;
      style.top = rect.top - 8;
      style.transform = 'translate(-50%, -100%)';
    } else if (placement === 'bottom') {
      style.left = rect.left + rect.width / 2;
      style.top = rect.bottom + 8;
      style.transform = 'translate(-50%, 0)';
    }
    return style;
  };

  // Recalculate tooltip position on show
  useEffect(() => {
    if (visible) {
      window.requestAnimationFrame(() => setStyle(getTooltipStyle()));
    }
    // eslint-disable-next-line
  }, [visible, placement, content]);

  return (
    <span
      ref={nodeRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      style={{ outline: 'none', cursor: 'pointer', display: 'inline-block' }}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          style={{
            ...style,
            background: '#23233a',
            color: '#fff',
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: 14,
            boxShadow: '0 2px 12px #0007',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            letterSpacing: 0.1,
            opacity: 0.96,
            fontWeight: 400
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
}

export default Tooltip;
