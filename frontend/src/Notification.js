import React, { useEffect } from 'react';

function Notification({ message, type = 'info', onClose, duration = 2500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  let bg = '#23233a';
  if (type === 'success') bg = '#2e7d32';
  if (type === 'error') bg = '#c62828';
  if (type === 'warning') bg = '#ed6c02';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: bg,
        color: '#fff',
        padding: '12px 32px',
        borderRadius: 8,
        boxShadow: '0 2px 16px #0006',
        zIndex: 9999,
        fontSize: 16,
        letterSpacing: 0.1,
        minWidth: 180,
        textAlign: 'center',
        opacity: 0.97
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export default Notification;
