// Backend API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// --- File Operations ---
export async function listFiles(directory) {
  const res = await fetch(`${API_URL}/list_dir/?path=${encodeURIComponent(directory)}`);
  const data = await res.json();
  // Trigger indexing in the background
  indexCode(directory).catch(() => {});
  return data;
}

export async function readFile(path) {
  const res = await fetch(`${API_URL}/file/?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('File not found');
  return res.text();
}

export async function writeFile(path, content) {
  const form = new FormData();
  form.append('path', path);
  form.append('content', content);
  const res = await fetch(`${API_URL}/file/`, { method: 'POST', body: form });
  return res.json();
}

// --- AI Endpoints ---
export async function aiSuggest(code, language = 'python') {
  const res = await fetch(`${API_URL}/ai/suggest/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language })
  });
  return res.json();
}

export async function aiReview(code, language = 'python') {
  const res = await fetch(`${API_URL}/ai/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language })
  });
  return res.json();
}

export async function aiChat(history, currentDirectory) {
  const res = await fetch(`${API_URL}/ai/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      history,
      current_directory: currentDirectory || ''
    })
  });
  return res.json();
}

// --- Code Execution ---
export async function executeCode(code, language) {
  const res = await fetch(`${API_URL}/execute/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language })
  });
  return res.json();
}

// Update the endpoint as needed
export async function submitCodeForSuggestions(code) {
  const response = await axios.post(`${API_URL}/ai/suggest/`, { code });
  return response.data;
}

// --- AI Code Change Suggestion & Application ---
export async function aiSuggestChanges(path) {
  const form = new FormData();
  form.append('path', path);
  const res = await fetch(`${API_URL}/ai/suggest_changes/`, {
    method: 'POST',
    body: form
  });
  return res.json();
}

export async function aiApplyChange(path, newContent) {
  const form = new FormData();
  form.append('path', path);
  form.append('new_content', newContent);
  const res = await fetch(`${API_URL}/ai/apply_change/`, {
    method: 'POST',
    body: form
  });
  return res.json();
}

// --- Workspace Persistence ---
export function saveSelectedWorkspace(name) {
  localStorage.setItem('onpoint_selected_workspace', name);
}

export function getSelectedWorkspace() {
  return localStorage.getItem('onpoint_selected_workspace');
}

// --- Indexing ---
export async function indexCode(currentDirectory) {
  const formData = new FormData();
  formData.append('current_directory', currentDirectory);
  const res = await fetch(`${API_URL}/index_code/`, {
    method: 'POST',
    body: formData
  });
  return res.json();
}
