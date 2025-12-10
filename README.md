Catalog Performance Analyzer (FastAPI + React)

Folders:
  - backend/: FastAPI backend
  - frontend/: React + Vite frontend

Quick start (local):

1) Backend
   cd backend
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8000

2) Frontend
   cd frontend
   npm install
   npm run dev

Open frontend in browser (Vite will show port)
Upload Sales CSV + FBF Stock CSV on the Upload page.
