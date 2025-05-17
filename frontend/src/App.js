import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './DarkTheme.css';
import CodeEditor from './CodeEditor';
import FileExplorer from './FileExplorer';
import Header from './Header';
import ChatbotPanel from './ChatbotPanel';
import { submitCodeForSuggestions } from './api';
import Breadcrumbs from './Breadcrumbs';
import * as monaco from 'monaco-editor';
import CollapsibleResizablePanel from './CollapsibleResizablePanel';
import StatusBar from './StatusBar';
import TopMenuBar from './TopMenuBar';
import TerminalPanel from './TerminalPanel';
import Notification from './Notification';

// Debounce helper
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

async function getDirectoryTree(dirHandle, path = '') {
  const tree = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      tree.push({ type: 'file', name: entry.name, path: path + '/' + entry.name, handle: entry });
    } else if (entry.kind === 'directory') {
      tree.push({
        type: 'folder',
        name: entry.name,
        path: path + '/' + entry.name,
        handle: entry,
        children: await getDirectoryTree(entry, path + '/' + entry.name)
      });
    }
  }
  return tree;
}

// Helper: Recursively traverse directory
const getFilesRecursive = async (dirHandle, path = '') => {
  let files = [];
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      files.push({ path: entryPath, handle: entry });
    } else if (entry.kind === 'directory') {
      const subFiles = await getFilesRecursive(entry, entryPath);
      files = files.concat(subFiles);
    }
  }
  return files;
};

function App() {
  const [codeTabs, setCodeTabs] = useState([
    { path: 'src/App.js', name: 'App.js', content: '// Start coding here...' }
  ]);
  const [activeTab, setActiveTab] = useState('src/App.js');
  const [suggestions, setSuggestions] = useState({});
  const [suggestionsLoading, setSuggestionsLoading] = useState({});
  const [suggestionsError, setSuggestionsError] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileTree, setFileTree] = useState(null);
  const [folderHandle, setFolderHandle] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [checkResult, setCheckResult] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const editorRef = useRef(null);
  const [decorations, setDecorations] = useState([]);
  const [contextModal, setContextModal] = useState({ open: false, title: '', content: '', fix: '' });
  const [lastIssues, setLastIssues] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [bottomTab, setBottomTab] = useState('suggestions'); // 'terminal' or 'suggestions'
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const activeTabObj = codeTabs.find(tab => tab.path === activeTab);

  // Store selected directory handle and file list
  const [projectDirHandle, setProjectDirHandle] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);

  // Notification state
  const [notif, setNotif] = useState({ message: '', type: 'info' });
  const showNotif = (message, type = 'info') => setNotif({ message, type });

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    const debouncedAnalyze = debounce(async () => {
      setLoading(true);
      setAnalysis('');
      clearMarkers();
      try {
        const code = model.getValue();
        const language = getLanguage();
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
        });
        const data = await res.json();
        setAnalysis(data.analysis || 'No issues found.');
        const issues = parseIssues(data.analysis || '');
        setMarkers(issues);
      } catch (e) {
        setAnalysis('Error analyzing code.');
      }
      setLoading(false);
    }, 1500);
    const disposable = model.onDidChangeContent(debouncedAnalyze);
    return () => disposable.dispose();
  }, [editorRef.current]);

  useEffect(() => {
    if (!editorRef.current) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleCheck();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorRef.current]);

  useEffect(() => {
    if (!editorRef.current) {
      const editorContainer = document.getElementById('editor-container');
      if (editorContainer) {
        editorRef.current = monaco.editor.create(editorContainer, {
          value: '',
          language: 'python',
          theme: 'vs-dark',
          automaticLayout: true,
        });
        // Add context menu actions
        editorRef.current.addAction({
          id: 'explain-selection',
          label: 'Explain Selection (AI)',
          keybindings: [],
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.5,
          run: async (ed) => {
            const selection = ed.getModel().getValueInRange(ed.getSelection());
            if (selection.trim()) {
              setLoading(true);
              const language = getLanguage();
              const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: selection, language }),
              });
              const data = await res.json();
              setContextModal({ open: true, title: 'AI Explanation', content: data.analysis || 'No explanation found.', fix: extractFix(data.analysis || '') });
              setLoading(false);
            }
          },
        });
        editorRef.current.addAction({
          id: 'fix-selection',
          label: 'Fix Selection (AI)',
          keybindings: [],
          contextMenuGroupId: 'navigation',
          contextMenuOrder: 1.6,
          run: async (ed) => {
            const selection = ed.getModel().getValueInRange(ed.getSelection());
            if (selection.trim()) {
              setLoading(true);
              const language = getLanguage();
              const res = await fetch('/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: selection, language }),
              });
              const data = await res.json();
              setContextModal({ open: true, title: 'AI Fix Suggestion', content: data.feedback || 'No fix found.', fix: extractFix(data.feedback || '') });
              setLoading(false);
            }
          },
        });
      }
    }
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && activeTabObj) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== activeTabObj.content) {
        editorRef.current.setValue(activeTabObj.content || '');
      }
    }
  }, [activeTabObj?.content, activeTab]);

  // Debounced AI analysis on code change
  const aiDebounceRef = useRef();
  const sendCodeToAI = async (code, filePath) => {
    setSuggestionsLoading(s => ({ ...s, [filePath]: true }));
    setSuggestionsError(s => ({ ...s, [filePath]: null }));
    try {
      const resp = await fetch('http://localhost:8000/ai/suggest/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }) // Adjust language as needed
      });
      if (!resp.ok) throw new Error('AI backend error');
      const data = await resp.json(); // { suggestion: "..." }
      const aiSuggestions = data.suggestion ? [{ message: data.suggestion }] : [];
      setSuggestions(s => ({ ...s, [filePath]: aiSuggestions }));
      setSuggestionsLoading(s => ({ ...s, [filePath]: false }));
    } catch (e) {
      setSuggestionsError(s => ({ ...s, [filePath]: 'AI analysis failed.' }));
      setSuggestionsLoading(s => ({ ...s, [filePath]: false }));
      setSuggestions(s => ({ ...s, [filePath]: [] }));
    }
  };

  const handleEditorChange = (value) => {
    if (!activeTabObj) return;
    // Update code in state
    setCodeTabs((tabs) => tabs.map(tab =>
      tab.path === activeTab ? { ...tab, content: value } : tab
    ));
    // Debounce AI call
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(() => {
      sendCodeToAI(value, activeTab);
    }, 1500);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const code = codeTabs.find(tab => tab.path === activeTab)?.content || '';
      const result = await submitCodeForSuggestions(code);
      setSuggestions(result.suggestions || []);
    } catch (e) {
      setError('Failed to get suggestions.');
    }
    setLoading(false);
  };

  const handleAcceptSuggestion = (suggestion) => {
    const newContent = activeTabObj.content + '\n' + suggestion.message;
    setCodeTabs((prevTabs) => prevTabs.map(tab =>
      tab.path === activeTab ? { ...tab, content: newContent } : tab
    ));
    setSuggestions((prev) => prev.filter((s) => s.message !== suggestion.message));
  };

  const handleRejectSuggestion = (suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.message !== suggestion.message));
  };

  const handleFileClick = async (fullPath, fileHandle) => {
    // If already open, just activate
    if (codeTabs.some(tab => tab.path === fullPath)) {
      setActiveTab(fullPath);
      showNotif('Tab activated.', 'info');
      return;
    }
    // Try to read file content if handle is provided
    let content = '';
    if (fileHandle && fileHandle.getFile) {
      try {
        const file = await fileHandle.getFile();
        content = await file.text();
      } catch {
        showNotif('Failed to read file.', 'error');
      }
    }
    setCodeTabs(tabs => [...tabs, { path: fullPath, name: fullPath.split('/').pop(), content, fileHandle }]);
    setActiveTab(fullPath);
    showNotif('File opened.', 'success');
  };

  const handleTabClose = (tabPath) => {
    setCodeTabs((tabs) => {
      const idx = tabs.findIndex(tab => tab.path === tabPath);
      if (idx === -1) return tabs;
      const newTabs = tabs.slice(0, idx).concat(tabs.slice(idx + 1));
      if (tabPath === activeTab && newTabs.length) {
        setActiveTab(newTabs[Math.max(0, idx - 1)].path);
      }
      return newTabs;
    });
    showNotif('Tab closed.', 'info');
  };

  const handleOpenFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker();
        if (window.localStorage && handle && handle.name) {
          // Use handle.name as id for now (better: use .id if available)
          window.localStorage.setItem('onpoint-folder', handle.name);
        }
        setFolderHandle(handle);
        const tree = await getDirectoryTree(handle);
        setFileTree(tree);
      } catch (e) {
        // User cancelled or not supported
      }
    }
  };

  const handlePromptAI = (prompt) => {
    alert('Prompt sent to AI: ' + prompt); // Replace with real integration
  };

  // Save active tab content to the file system
  const handleSave = async () => {
    const tab = codeTabs.find(t => t.path === activeTab);
    if (!tab || !tab.fileHandle) return;
    try {
      const writable = await tab.fileHandle.createWritable();
      await writable.write(tab.content);
      await writable.close();
      setError('');
      showNotif('File saved.', 'success');
    } catch (e) {
      setError('Failed to save file: ' + e.message);
      showNotif('Save failed.', 'error');
    }
  };

  // Keyboard shortcut for save
  React.useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, codeTabs]);

  const clearMarkers = () => {
    if (editorRef.current) {
      monaco.editor.setModelMarkers(editorRef.current.getModel(), 'ai', []);
      setDecorations(editorRef.current.deltaDecorations(decorations, []));
    }
  };

  // Enhanced: Parse issues with type/category if possible
  const parseIssues = (text) => {
    const lines = text.split('\n');
    return lines
      .map(line => {
        // Example AI output: "Line 12 [Syntax]: Missing colon at end of function definition"
        const match = line.match(/Line (\d+)(?: \[(\w+)\])?: (.+)/);
        if (match) {
          return {
            lineNumber: parseInt(match[1], 10),
            type: match[2] || 'General',
            message: match[3],
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  // Jump to a specific line in Monaco
  const jumpToLine = (lineNumber) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
      editorRef.current.focus();
    }
  };

  // Update setMarkers to also update lastIssues
  const setMarkers = (issues) => {
    if (!editorRef.current) return;
    setLastIssues(issues);
    const model = editorRef.current.getModel();
    const markers = issues.map(issue => ({
      startLineNumber: issue.lineNumber,
      endLineNumber: issue.lineNumber,
      startColumn: 1,
      endColumn: model.getLineLength(issue.lineNumber) + 1,
      message: `[${issue.type}] ${issue.message}`,
      severity: monaco.MarkerSeverity.Warning,
      source: 'AI',
    }));
    monaco.editor.setModelMarkers(model, 'ai', markers);
  };

  const handleAnalyze = async () => {
    setLoadingAnalysis(true);
    setAnalysis('');
    clearMarkers();
    try {
      const code = getCode();
      const language = getLanguage();
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || 'No issues found.');
      const issues = parseIssues(data.analysis || '');
      setMarkers(issues);
    } catch (e) {
      setAnalysis('Error analyzing code.');
    }
    setLoadingAnalysis(false);
  };

  const handleCheck = async () => {
    setLoadingAnalysis(true);
    setCheckResult('');
    clearMarkers();
    try {
      const code = getCode();
      const language = getLanguage();
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setCheckResult(data.feedback || 'No problems found.');
      const issues = parseIssues(data.feedback || '');
      setMarkers(issues);
    } catch (e) {
      setCheckResult('Error checking code.');
    }
    setLoadingAnalysis(false);
  };

  const applyFix = (fix) => {
    if (editorRef.current && fix) {
      editorRef.current.setValue(fix);
    }
  };

  const extractFix = (text) => {
    const match = text.match(/```[\w\d]*\n([\s\S]*?)```/);
    return match ? match[1] : '';
  };

  const fixFromAnalysis = extractFix(analysis);
  const fixFromCheck = extractFix(checkResult);

  const closeModal = () => setContextModal({ open: false, title: '', content: '', fix: '' });
  const applyContextFix = () => {
    if (editorRef.current && contextModal.fix) {
      const range = editorRef.current.getSelection();
      editorRef.current.executeEdits('ai-fix', [
        { range, text: contextModal.fix, forceMoveMarkers: true },
      ]);
      closeModal();
    }
  };

  // Helper to get current editor language
  const getLanguage = () => {
    if (editorRef.current) {
      return editorRef.current.getModel().getLanguageId();
    }
    return 'python'; // fallback
  };

  // Render the rich feedback panel
  const renderIssuesPanel = () => (
    <div style={{ background: '#181c23', color: '#fff', padding: '1rem', minHeight: '120px', borderTop: '1px solid #333' }}>
      <h4 style={{ marginBottom: 8 }}>AI Issues & Suggestions</h4>
      {lastIssues.length === 0 ? (
        <div>No issues detected.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {lastIssues.map((issue, idx) => (
            <li key={idx} style={{ marginBottom: 6 }}>
              <span style={{ color: '#7fd', cursor: 'pointer', marginRight: 8 }} onClick={() => jumpToLine(issue.lineNumber)}>
                Line {issue.lineNumber}
              </span>
              <span style={{ color: '#f7c873', marginRight: 8 }}>[{issue.type}]</span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  function ChatPanel({ editorRef, getLanguage }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [includeContext, setIncludeContext] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const sendMessage = async () => {
      if (!input.trim()) return;
      setLoading(true);
      setError(null);
      const code = includeContext && editorRef.current ? editorRef.current.getValue() : '';
      const language = getLanguage();
      setMessages(msgs => [...msgs, { role: 'user', text: input }]);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: input, code, language }),
        });
        const data = await res.json();
        if (data.error) {
          setMessages(msgs => [...msgs, { role: 'ai', text: `Error: ${data.error || 'Unknown error from backend.'}` }]);
          setError(data.error || 'Unknown error from backend.');
        } else if (data.answer && data.answer.trim()) {
          setMessages(msgs => [...msgs, { role: 'ai', text: data.answer }]);
        } else {
          setMessages(msgs => [...msgs, { role: 'ai', text: 'No answer received from AI.' }]);
        }
      } catch (e) {
        setMessages(msgs => [...msgs, { role: 'ai', text: 'Network or server error.' }]);
        setError('Network or server error.');
      }
      setLoading(false);
      setInput('');
    };

    return (
      <div style={{ background: '#1a1e25', color: '#fff', padding: 12, borderLeft: '2px solid #333', width: 340, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: 0, marginBottom: 8 }}>Ask AI (Gemini)</h4>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8, padding: 4, borderRadius: 4, background: '#20232a' }}>
          {messages.length === 0 && (
            <div style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
              Start a conversation with the AI about your code.
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: 8, color: msg.role === 'user' ? '#7fd' : msg.text.startsWith('Error') ? '#ffb3b3' : '#f7c873' }}>
              <b>{msg.role === 'user' ? 'You' : 'AI'}:</b> <span>{msg.text}</span>
            </div>
          ))}
          {loading && (
            <div style={{ color: '#7fd', fontStyle: 'italic', marginTop: 8 }}>AI is thinking...</div>
          )}
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)} rows={2} disabled={loading} style={{ width: '100%', resize: 'none', marginBottom: 4, background: '#222', color: '#fff', border: '1px solid #444' }} placeholder="Ask about your code..." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} id="chat-context" />
          <label htmlFor="chat-context" style={{ fontSize: 13 }}>Include current code context</label>
        </div>
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: '100%', padding: 6, background: '#7fd', color: '#222', border: 'none', borderRadius: 4 }}>
          {loading ? 'Asking...' : 'Ask AI'}
        </button>
        {error && (
          <div style={{ color: '#ffb3b3', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Helper: Convert flat file list to tree
  function filesToTree(files) {
    const root = { name: '/', children: [], isDir: true };
    for (const { path, handle } of files) {
      const parts = path.split('/');
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let child = node.children.find(c => c.name === part);
        if (!child) {
          child = {
            name: part,
            isDir: i < parts.length - 1,
            children: [],
            handle: i === parts.length - 1 ? handle : undefined
          };
          node.children.push(child);
        }
        node = child;
      }
    }
    console.log('filesToTree result:', root); // DEBUG
    return root;
  }

  // Menu action handler
  const handleMenuAction = async (action) => {
    if (action === 'open') {
      // Open file using File System Access API
      if (!window.showOpenFilePicker) {
        showNotif('File open not supported in this browser.', 'error');
        return;
      }
      try {
        const [fileHandle] = await window.showOpenFilePicker();
        const file = await fileHandle.getFile();
        const content = await file.text();
        setCodeTabs((tabs) => {
          const path = fileHandle.name;
          if (tabs.some(tab => tab.path === path)) return tabs;
          return [...tabs, { path, name: path, content, fileHandle }];
        });
        setActiveTab(fileHandle.name);
        showNotif('File opened successfully.', 'success');
      } catch (e) {
        if (e && e.name !== 'AbortError') showNotif('Failed to open file.', 'error');
      }
    } else if (action === 'save') {
      // Save current file (if it was opened via File System Access API)
      const tab = codeTabs.find(tab => tab.path === activeTab);
      if (tab?.fileHandle) {
        try {
          const writable = await tab.fileHandle.createWritable();
          await writable.write(tab.content);
          await writable.close();
          showNotif('File saved.', 'success');
        } catch {
          showNotif('Save failed.', 'error');
        }
      } else {
        // Fallback to Save As
        handleMenuAction('saveAs');
      }
      // On save: trigger AI check
      await sendCodeToAI(tab.content, tab.path);
    } else if (action === 'saveAs') {
      // Save As using File System Access API
      if (!window.showSaveFilePicker) {
        showNotif('Save As not supported in this browser.', 'error');
        return;
      }
      const tab = codeTabs.find(tab => tab.path === activeTab);
      try {
        const newHandle = await window.showSaveFilePicker({
          suggestedName: tab?.name || 'untitled.txt'
        });
        const writable = await newHandle.createWritable();
        await writable.write(tab.content);
        await writable.close();
        setCodeTabs((tabs) => tabs.map(t => t.path === activeTab ? { ...t, fileHandle: newHandle, path: newHandle.name, name: newHandle.name } : t));
        setActiveTab(newHandle.name);
        showNotif('File saved.', 'success');
      } catch (e) {
        if (e && e.name !== 'AbortError') showNotif('Save failed.', 'error');
      }
    } else if (action === 'closeTab') {
      // Close the current tab
      handleTabClose(activeTab);
    } else if (action === 'toggleTerminal') {
      setBottomTab('terminal');
      setIsBottomCollapsed((collapsed) => !collapsed);
    } else if (action === 'toggleAI') {
      setShowChat((show) => !show);
    } else if (action === 'openFolder') {
      // Select project folder
      if (!window.showDirectoryPicker) {
        showNotif('Folder selection not supported in this browser.', 'error');
        return;
      }
      try {
        const dirHandle = await window.showDirectoryPicker();
        setProjectDirHandle(dirHandle);
        const files = await getFilesRecursive(dirHandle);
        console.log('Folder selected, files:', files); // DEBUG
        setProjectFiles(files);
        showNotif('Project folder loaded.', 'success');
      } catch (e) {
        if (e && e.name !== 'AbortError') showNotif('Failed to open folder.', 'error');
      }
    }
  };

  // On file open: trigger AI check
  useEffect(() => {
    if (activeTabObj && activeTabObj.content !== undefined) {
      sendCodeToAI(activeTabObj.content, activeTabObj.path);
    }
    // eslint-disable-next-line
  }, [activeTab]);

  // SuggestionsPanel rendering (with improved readability)
  const SuggestionsPanel = () => {
    const items = suggestions[activeTab] || [];
    const suggestionText = items.length > 0 ? items[0].message : '';
    let lines = suggestionText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return (
      <div className="suggestions-panel" style={{ background: '#23233a', color: '#e0e0e0', padding: 12, minHeight: 80, borderLeft: '1px solid #353b45' }}>
        <h6>AI Suggestions</h6>
        {suggestionsLoading[activeTab] ? (
          <span>Analyzing code...</span>
        ) : suggestionsError[activeTab] ? (
          <span style={{ color: '#ff6161' }}>{suggestionsError[activeTab]}</span>
        ) : (lines.length > 0) ? (
          <div>
            {lines.length === 1 ? (
              <p style={{ marginBottom: 0 }}>{lines[0]}</p>
            ) : (
              <ul style={{ paddingLeft: 20 }}>
                {lines.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button onClick={() => handleAcceptSuggestion(items[0])} style={{ padding: 6, background: '#7fd', color: '#222', border: 'none', borderRadius: 4 }}>
                Accept
              </button>
              <button onClick={() => handleRejectSuggestion(items[0])} style={{ padding: 6, background: '#f7c873', color: '#222', border: 'none', borderRadius: 4 }}>
                Reject
              </button>
            </div>
          </div>
        ) : (
          <span>No suggestions.</span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e2f' }}>
      {/* Top menu bar */}
      <TopMenuBar onMenuAction={handleMenuAction} />
      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar/File Explorer */}
        <div style={{ width: 220, background: '#23233a', borderRight: '1.5px solid #2d2d3d', display: 'flex', flexDirection: 'column' }}>
          <FileExplorer 
            onFileClick={handleFileClick} 
            openFiles={activeTab} 
            setOpenFiles={setActiveTab} 
            files={projectFiles.length ? filesToTree(projectFiles) : (fileTree || undefined)}
          />
        </div>
        {/* Main content (tabs + editor) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Tab bar */}
          <div className="tab-bar panel-shadow">
            {/* ...tab rendering logic here... */}
            {/* Placeholder: show open tabs */}
            {codeTabs.map(tab => (
              <div
                key={tab.path}
                className={`tab${tab.path === activeTab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.path)}
                tabIndex={0}
              >
                {tab.name}
                <span className="close-btn" onClick={e => { e.stopPropagation(); handleTabClose(tab.path); }} tabIndex={0}>&times;</span>
              </div>
            ))}
          </div>
          {/* Editor area */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Main code editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <CodeEditor
                code={activeTabObj?.content || ''}
                onChange={handleEditorChange}
              />
            </div>
            {/* AI Suggestions Panel (right) */}
            <div style={{ width: 300, borderLeft: '1.5px solid #2d2d3d', background: '#23233a' }}>
            <SuggestionsPanel 
    suggestions={suggestions} 
    onAccept={handleAcceptSuggestion} 
    onReject={handleRejectSuggestion} 
/>
            </div>
          </div>
          {/* Terminal Panel (bottom) */}
          {!isBottomCollapsed && bottomTab === 'terminal' && (
            <div style={{ width: '100%' }}>
              <TerminalPanel visible={!isBottomCollapsed && bottomTab === 'terminal'} />
            </div>
          )}
        </div>
      </div>
      {/* Status Bar */}
      <StatusBar file={activeTabObj?.name} lang={/* pass language here if available */ ''} />
      {/* Notification Snackbar */}
      <Notification message={notif.message} type={notif.type} onClose={() => setNotif({ message: '', type: 'info' })} />
    </div>
  );
}

export default App;
