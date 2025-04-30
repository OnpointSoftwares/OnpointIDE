import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { aiChat, getSelectedWorkspace } from './api';

function ChatbotPanel() {
  const [history, setHistory] = useState([
    { role: 'assistant', content: 'Hi! How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newHistory = [...history, { role: 'user', content: input }];
    setHistory(newHistory);
    setLoading(true);
    setError(null);
    try {
      const currentDirectory = getSelectedWorkspace();
      const res = await aiChat(newHistory, currentDirectory);
      setHistory((prev) => [
        ...newHistory,
        { role: 'assistant', content: res.response || '[No response from Gemini]' }
      ]);
    } catch (err) {
      setError('Error contacting Gemini AI.');
      setHistory((prev) => [
        ...newHistory,
        { role: 'assistant', content: '[Error: Could not get AI response]' }
      ]);
    }
    setLoading(false);
    setInput('');
  };

  return (
    <div className="ChatbotPanel bg-dark text-light panel-shadow" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e2f', color: '#d4d4d4', borderRadius: 8, padding: 0, border: '1.5px solid #353b45' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#1e1e2f', color: '#d4d4d4' }}>
        {history.map((msg, idx) => (
          <div key={idx} style={{
            textAlign: msg.role === 'assistant' ? 'left' : 'right',
            marginBottom: 10
          }}>
            <span style={{
              display: 'inline-block',
              background: msg.role === 'assistant' ? '#23233a' : '#353b45',
              color: '#d4d4d4',
              borderRadius: 8,
              padding: '7px 14px',
              maxWidth: '80%',
              fontSize: 15,
              boxShadow: '0 1px 5px 0 rgba(20,20,40,0.12)'
            }}>{msg.content}</span>
          </div>
        ))}
        {loading && <div className="text-muted">Gemini is typing...</div>}
        {error && <div className="text-danger">{error}</div>}
      </div>
      <div style={{ borderTop: '1.5px solid #353b45', padding: 10, background: '#23233a', borderRadius: '0 0 8px 8px' }}>
        <Form onSubmit={e => { e.preventDefault(); handleSend(); }}>
          <Form.Group className="mb-0" style={{ display: 'flex' }}>
            <Form.Control
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className="form-control bg-dark text-light"
              style={{ background: '#23233a', color: '#d4d4d4', border: '1.5px solid #353b45' }}
            />
            <Button type="submit" variant="primary" disabled={loading || !input.trim()} className="ms-2" style={{ background: '#23233a', color: '#d4d4d4', border: '1.5px solid #353b45' }}>
              Send
            </Button>
          </Form.Group>
        </Form>
      </div>
    </div>
  );
}

export default ChatbotPanel;
