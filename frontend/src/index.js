import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import { registerGeminiCompletionProvider } from './monacoGeminiProvider';
import * as monaco from 'monaco-editor';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

const editor = monaco.editor.create(document.getElementById('root'), {
  value: '',
  language: 'python', 
  theme: 'vs-dark',
  automaticLayout: true,
});

registerGeminiCompletionProvider('python');
