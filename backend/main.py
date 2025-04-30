from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
import os
from pydantic import BaseModel
import tempfile
import subprocess
import uuid
from datetime import datetime
import json
import google.generativeai as genai
from dotenv import load_dotenv
from difflib import unified_diff
import requests
import httpx
import pty
import asyncio

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(os.environ.get("ONPOINT_WORKSPACE", "./workspace")).resolve()
BASE_DIR.mkdir(parents=True, exist_ok=True)

VERSIONS_DIR = BASE_DIR / ".onpoint_versions"
VERSIONS_DIR.mkdir(exist_ok=True)

SETTINGS_FILE = BASE_DIR / "settings.json"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not set. AI endpoints will not work.")

# Helper to call Gemini
async def gemini_generate(prompt: str, model: str = "gemini-2.0-flash"):
    try:
        response = genai.GenerativeModel(model).generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"[Gemini error: {e}]"

# Helper to call Deepseek
async def deepseek_generate(prompt: str, model: str = "deepseek-coder"):
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    try:
        r = requests.post(url, json=payload, timeout=120)
        r.raise_for_status()
        data = r.json()
        return data.get("response") or data.get("message") or "[No response from Deepseek]"
    except Exception as e:
        return f"[Deepseek error: {e}]"

def safe_path(rel_path: str) -> Path:
    p = (BASE_DIR / rel_path).resolve()
    if not str(p).startswith(str(BASE_DIR)):
        raise HTTPException(status_code=400, detail="Invalid path")
    return p

def save_version(file_path: Path):
    if not file_path.exists() or not file_path.is_file():
        return
    rel_path = file_path.relative_to(BASE_DIR)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    version_path = VERSIONS_DIR / rel_path
    version_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path = version_path.with_name(f"{version_path.name}.{ts}")
    shutil.copy2(file_path, backup_path)

@app.get("/files/")
def list_files(path: str = ""):
    dir_path = safe_path(path)
    if not dir_path.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    return [{
        "name": f.name,
        "is_dir": f.is_dir()
    } for f in dir_path.iterdir()]

@app.get("/file/")
def read_file(path: str):
    file_path = safe_path(path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path))

@app.post("/file/")
def write_file(path: str = Form(...), content: str = Form(...)):
    file_path = safe_path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if file_path.exists():
        save_version(file_path)
    file_path.write_text(content)
    return {"status": "ok"}

@app.post("/file/upload/")
def upload_file(path: str = Form(...), file: UploadFile = File(...)):
    file_path = safe_path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "ok"}

@app.delete("/file/")
def delete_file(path: str):
    file_path = safe_path(path)
    if file_path.is_file():
        file_path.unlink()
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/folder/")
def create_folder(path: str = Form(...)):
    folder_path = safe_path(path)
    folder_path.mkdir(parents=True, exist_ok=True)
    return {"status": "created"}

@app.delete("/folder/")
def delete_folder(path: str):
    folder_path = safe_path(path)
    if folder_path.is_dir():
        shutil.rmtree(folder_path)
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Folder not found")

@app.post("/rename/")
def rename_path(old_path: str = Form(...), new_path: str = Form(...)):
    src = safe_path(old_path)
    dst = safe_path(new_path)
    src.rename(dst)
    return {"status": "renamed"}

@app.get("/workspaces/")
def list_workspaces():
    # List all top-level folders (projects) in BASE_DIR
    return [
        {"name": f.name, "path": str(f.relative_to(BASE_DIR))}
        for f in BASE_DIR.iterdir() if f.is_dir()
    ]

@app.post("/workspaces/")
def create_workspace(name: str = Form(...)):
    ws_path = safe_path(name)
    ws_path.mkdir(parents=True, exist_ok=True)
    return {"status": "created", "name": name}

@app.delete("/workspaces/")
def delete_workspace(name: str):
    ws_path = safe_path(name)
    if ws_path.is_dir():
        shutil.rmtree(ws_path)
        return {"status": "deleted", "name": name}
    raise HTTPException(status_code=404, detail="Workspace not found")

@app.post("/workspaces/rename/")
def rename_workspace(old_name: str = Form(...), new_name: str = Form(...)):
    old_path = safe_path(old_name)
    new_path = safe_path(new_name)
    old_path.rename(new_path)
    return {"status": "renamed", "old_name": old_name, "new_name": new_name}

class CodeRequest(BaseModel):
    code: str
    language: str = "python"

class ChatHistoryRequest(BaseModel):
    history: list  # [{role: 'user'|'assistant', content: str}]
    current_directory: str = None  # relative to BASE_DIR

class ChatRequest(BaseModel):
    message: str

class ExecRequest(BaseModel):
    code: str
    language: str  # "python" or "javascript"

@app.post("/ai/suggest/")
async def ai_suggest(req: CodeRequest):
    prompt = f"Suggest an improvement or next step for this {req.language} code:\n\n{req.code}\n\nRespond with only the code suggestion or next edit, no explanation."
    suggestion = await gemini_generate(prompt)
    return {"suggestion": suggestion}

@app.post("/ai/review/")
async def ai_review(req: CodeRequest):
    prompt = f"Review the following {req.language} code and provide feedback, suggestions, and possible improvements.\n\n{req.code}"
    review = await gemini_generate(prompt)
    return {"review": review}

@app.post("/ai/chat/")
async def ai_chat(req: ChatHistoryRequest):
    prompt = "You are a helpful coding assistant."
    if req.current_directory:
        dir_path = safe_path(req.current_directory)
        dir_listing = get_directory_listing(dir_path)
        prompt += (
            f"\nCurrent directory: {req.current_directory}\n"
            f"Directory contents:\n{dir_listing}\n"
            f"First, explain the structure and contents of this directory to the user in clear language. Then continue the conversation as normal. it is in kali linux"
        )
        # Load and include code index
        settings_path = dir_path / 'settings.json'
        if settings_path.exists():
            try:
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
                code_index = settings.get('code_index', [])
                if code_index:
                    prompt += '\nHere is an index of code in this directory:'
                    for item in code_index:
                        prompt += f"\n- File: {item['path']} ({item['type']})"
                        if item.get('functions'):
                            prompt += f"\n  Functions: {', '.join(item['functions'])}"
                        if item.get('classes'):
                            prompt += f"\n  Classes: {', '.join(item['classes'])}"
                        prompt += f"\n  Snippet:\n{item['snippet']}\n"
            except Exception:
                pass
    prompt += "\nHere is the conversation so far:\n"
    for msg in req.history:
        role = "User" if msg['role'] == 'user' else 'Assistant'
        prompt += f"{role}: {msg['content']}\n"
    prompt += "Assistant:"
    response = await gemini_generate(prompt)
    return {"response": response}

@app.post("/execute/")
def execute_code(req: ExecRequest):
    if req.language not in ("python", "javascript"):
        raise HTTPException(status_code=400, detail="Unsupported language")
    with tempfile.TemporaryDirectory() as tmpdir:
        if req.language == "python":
            file_path = Path(tmpdir) / "script.py"
            file_path.write_text(req.code)
            cmd = ["python3", str(file_path)]
        else:
            file_path = Path(tmpdir) / "script.js"
            file_path.write_text(req.code)
            cmd = ["node", str(file_path)]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=6
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": "Execution timed out.",
                "exit_code": -1
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": f"Execution error: {str(e)}",
                "exit_code": -2
            }

def get_directory_listing(path: Path, max_files=20):
    # List up to max_files in the directory, show file names and types
    entries = []
    for entry in sorted(path.iterdir()):
        if len(entries) >= max_files:
            entries.append("...")
            break
        if entry.is_file():
            entries.append(f"[F] {entry.name}")
        elif entry.is_dir():
            entries.append(f"[D] {entry.name}/")
    return '\n'.join(entries)

@app.post("/ai/suggest_changes/")
async def ai_suggest_changes(path: str = Form(...)):
    file_path = safe_path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    dir_path = file_path.parent
    dir_listing = get_directory_listing(dir_path)
    with open(file_path, "r") as f:
        original_code = f.read()
    prompt = (
        f"You are an expert developer. The file is located at: {str(file_path.relative_to(BASE_DIR))}\n"
        f"Directory contents:\n{dir_listing}\n\n"
        f"Analyze and suggest improvements or refactoring for the following code. "
        f"Respond with the complete improved code only, no explanation.\n\n"
        f"Filename: {file_path.name}\n"
        f"Code:\n{original_code}"
    )
    improved_code = await gemini_generate(prompt)
    # Generate diff
    diff = list(unified_diff(
        original_code.splitlines(),
        improved_code.splitlines(),
        fromfile=f"original/{file_path.name}",
        tofile=f"suggested/{file_path.name}",
        lineterm=''  # no extra newlines
    ))
    return {
        "diff": '\n'.join(diff),
        "suggested": improved_code,
        "original": original_code,
        "filename": file_path.name,
        "path": str(file_path.relative_to(BASE_DIR))
    }

@app.post("/ai/apply_change/")
async def ai_apply_change(path: str = Form(...), new_content: str = Form(...)):
    file_path = safe_path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Save version before overwrite
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    version_file = VERSIONS_DIR / f"{file_path.name}.{ts}"
    with open(file_path, "r") as f:
        orig = f.read()
    with open(version_file, "w") as f:
        f.write(orig)
    # Write new content
    with open(file_path, "w") as f:
        f.write(new_content)
    return {"status": "applied", "path": str(file_path.relative_to(BASE_DIR))}

@app.get("/file/versions/")
def list_versions(path: str):
    file_path = safe_path(path)
    rel_path = file_path.relative_to(BASE_DIR)
    version_glob = (VERSIONS_DIR / rel_path).parent.glob(f"{file_path.name}.*")
    versions = [
        {
            "filename": v.name,
            "timestamp": v.name.split(".")[-1],
            "path": str(v.relative_to(VERSIONS_DIR))
        }
        for v in version_glob if v.is_file()
    ]
    versions.sort(key=lambda x: x["timestamp"], reverse=True)
    return versions

@app.get("/file/version/")
def get_version(version_path: str):
    version_file = VERSIONS_DIR / version_path
    if not version_file.exists():
        raise HTTPException(status_code=404, detail="Version not found")
    return FileResponse(str(version_file))

@app.post("/file/restore/")
def restore_version(path: str = Form(...), version_path: str = Form(...)):
    file_path = safe_path(path)
    version_file = VERSIONS_DIR / version_path
    if not version_file.exists():
        raise HTTPException(status_code=404, detail="Version not found")
    shutil.copy2(version_file, file_path)
    return {"status": "restored"}

@app.get("/settings/")
def get_settings():
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {}

@app.post("/settings/")
def update_settings(settings: dict):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)
    return {"status": "ok"}

@app.get("/workspace/settings/")
def get_workspace_settings(name: str):
    ws_path = safe_path(name)
    settings_path = ws_path / "settings.json"
    if settings_path.exists():
        with open(settings_path, "r") as f:
            return json.load(f)
    return {}

@app.post("/workspace/settings/")
def update_workspace_settings(name: str = Form(...), settings: str = Form(...)):
    ws_path = safe_path(name)
    settings_path = ws_path / "settings.json"
    try:
        settings_obj = json.loads(settings)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    with open(settings_path, "w") as f:
        json.dump(settings_obj, f, indent=2)
    return {"status": "ok"}

def recursive_index(dir_path, rel_path=""):
    index = []
    for entry in sorted(dir_path.iterdir()):
        entry_rel = str(entry.relative_to(BASE_DIR))
        if entry.is_dir():
            index.append({
                "path": entry_rel,
                "type": "directory"
            })
            index.extend(recursive_index(entry, rel_path=entry_rel))
        elif entry.is_file() and entry.suffix in {'.py', '.js', '.json'}:
            try:
                with open(entry, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                snippet = '\n'.join(code.splitlines()[:20])
            except Exception:
                snippet = ''
            funcs, classes = ([], [])
            if entry.suffix == '.py':
                try:
                    import ast
                    tree = ast.parse(code)
                    funcs = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
                    classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
                except Exception:
                    pass
            index.append({
                "path": entry_rel,
                "type": entry.suffix[1:],
                "functions": funcs,
                "classes": classes,
                "snippet": snippet
            })
    return index

@app.post("/index_code_recursive/")
def index_code_recursive(current_directory: str = Form(...)):
    dir_path = safe_path(current_directory)
    if not dir_path.exists() or not dir_path.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    index = recursive_index(dir_path)
    ws_settings_path = dir_path / 'settings.json'
    settings = {}
    if ws_settings_path.exists():
        try:
            with open(ws_settings_path, 'r') as f:
                settings = json.load(f)
        except Exception:
            settings = {}
    settings['code_index'] = index
    with open(ws_settings_path, 'w') as f:
        json.dump(settings, f, indent=2)
    return {"status": "ok", "count": len(index)}

@app.get("/get_code_index/")
def get_code_index(current_directory: str = Query(...)):
    dir_path = safe_path(current_directory)
    ws_settings_path = dir_path / 'settings.json'
    if ws_settings_path.exists():
        with open(ws_settings_path, 'r') as f:
            settings = json.load(f)
        return {"code_index": settings.get('code_index', [])}
    return {"code_index": []}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

@app.post("/api/suggest")
async def suggest_code(request: Request):
    data = await request.json()
    code_context = data.get("code", "")
    language = data.get("language", "python")
    prompt = f"Suggest the next lines of {language} code given the following context:\n{code_context}\n" 
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(GEMINI_API_URL, headers=headers, params=params, json=payload)
        response.raise_for_status()
        result = response.json()
    print("[GEMINI RAW RESPONSE]", result)
    try:
        suggestion = result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        suggestion = ""
    return {"suggestion": suggestion}

@app.post("/api/analyze")
async def analyze_code(request: Request):
    data = await request.json()
    code = data.get("code", "")
    language = data.get("language", "python")
    prompt = f"Analyze the following {language} code. Identify any unfinished functions, missing imports, or incomplete logic, and propose the missing code.\n\nCode:\n{code}\n\nAnalysis and proposed code:" 
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(GEMINI_API_URL, headers=headers, params=params, json=payload)
        response.raise_for_status()
        result = response.json()
    print("[GEMINI RAW RESPONSE]", result)
    try:
        analysis = result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        analysis = ""
    return {"analysis": analysis}

@app.post("/api/check")
async def check_code(request: Request):
    data = await request.json()
    code = data.get("code", "")
    language = data.get("language", "python")
    prompt = f"Check the following {language} code for correctness, including logic errors, syntax errors, and style issues. Provide a list of problems and suggestions for improvement.\n\nCode:\n{code}\n\nProblems and suggestions:" 
    headers = {"Content-Type": "application/json"}
    params = {"key": GEMINI_API_KEY}
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(GEMINI_API_URL, headers=headers, params=params, json=payload)
        response.raise_for_status()
        result = response.json()
    print("[GEMINI RAW RESPONSE]", result)
    try:
        feedback = result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        feedback = ""
    return {"feedback": feedback}

@app.post("/api/chat")
async def chat_with_ai(request: Request):
    try:
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not GEMINI_API_KEY:
            print("[ERROR] GEMINI_API_KEY not set in environment variables.")
            return {"error": "GEMINI_API_KEY not set."}
        data = await request.json()
        question = data.get("question", "")
        code_context = data.get("code", "")
        language = data.get("language", "python")
        prompt = f"You are an expert coding assistant. Answer the following user question about their {language} code. If code context is provided, use it to give a more accurate answer.\n\nCode context (if provided):\n{code_context}\n\nUser question: {question}\n\nAI answer:"
        headers = {"Content-Type": "application/json"}
        params = {"key": GEMINI_API_KEY}
        payload = {
            "contents": [
                {"parts": [{"text": prompt}]}
            ]
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(GEMINI_API_URL, headers=headers, params=params, json=payload)
            response.raise_for_status()
            result = response.json()
        print("[GEMINI RAW RESPONSE]", result)
        try:
            answer = result["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print("[ERROR] Failed to parse Gemini response:", result)
            answer = ""
        return {"answer": answer}
    except Exception as e:
        import traceback
        print("[ERROR] Exception in /api/chat endpoint:\n", traceback.format_exc())
        return {"error": str(e)}

@app.websocket("/ws/terminal/")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    master_fd, slave_fd = pty.openpty()
    process = await asyncio.create_subprocess_exec(
        '/bin/bash',
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd
    )
    loop = asyncio.get_event_loop()
    async def read_pty():
        try:
            while True:
                await asyncio.sleep(0.01)
                data = await loop.run_in_executor(None, lambda: os.read(master_fd, 1024))
                if data:
                    await websocket.send_text(data.decode(errors='ignore'))
        except Exception:
            pass
    reader_task = asyncio.create_task(read_pty())
    try:
        while True:
            data = await websocket.receive_text()
            os.write(master_fd, data.encode())
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
        process.terminate()
        os.close(master_fd)
        os.close(slave_fd)
        await websocket.close()
