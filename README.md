# OnPoint IDE

A modern, AI-powered Integrated Development Environment (IDE) for smart code editing and productivity. Combines a React-based frontend with a FastAPI backend that provides intelligent code suggestions using Gemini and Deepseek models.

## Features
- **File Explorer:** Browse, open, and edit files from any selected project folder
- **Monaco Editor:** Syntax-highlighted code editing
- **AI Suggestions:** Real-time code review and improvement suggestions (Gemini/Deepseek)
- **Notification System:** User feedback for file actions and errors
- **Dark Theme:** Professional, eye-friendly interface
- **Terminal & AI Assistant Panels:** Toggleable panels for productivity
- **Persistent Tabs:** Open multiple files without duplicates

## Tech Stack
- **Frontend:** React, Monaco Editor
- **Backend:** FastAPI, Gemini API, Deepseek Coder, Python 3.9+

## Setup

### 1. Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Set your Gemini API key in .env
uvicorn main:app --reload
```

### 2. Frontend (React)
```bash
cd frontend
npm install
npm start
```

- The frontend runs on [http://localhost:3000](http://localhost:3000)
- The backend runs on [http://localhost:8000](http://localhost:8000)

## Usage
- Select a project folder from the File menu to browse files.
- Click a file to open and edit it.
- AI suggestions are shown on file open and save, in the right panel.
- Save files to trigger new AI suggestions.

## Environment Variables
- `.env` in `backend/` should include your `GEMINI_API_KEY`.

## Contributing
Pull requests welcome! Please open issues for feature requests or bugs.

## License
MIT

