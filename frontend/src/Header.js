import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

function Header({ onOpenFolder, onPromptAI }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');

  const handlePromptSubmit = () => {
    onPromptAI(prompt);
    setShowPrompt(false);
    setPrompt('');
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ zIndex: 100, position: 'sticky', top: 0 }}>
        <div className="container-fluid">
          <span className="navbar-brand" style={{ fontWeight: 'bold', fontSize: 22 }}>Onpoint Studio</span>
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <button className="btn btn-link nav-link" onClick={onOpenFolder} style={{ color: 'inherit' }}>
                Open Folder
              </button>
            </li>
            <li className="nav-item">
              <button className="btn btn-link nav-link" onClick={() => setShowPrompt(true)} style={{ color: 'inherit' }}>
                Prompt AI
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <Modal show={showPrompt} onHide={() => setShowPrompt(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Prompt AI</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="aiPrompt">
              <Form.Label>Enter your prompt</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Ask Onpoint AI anything..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPrompt(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePromptSubmit} disabled={!prompt.trim()}>
            Send
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Header;
