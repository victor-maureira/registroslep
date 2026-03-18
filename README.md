# RegistroSlep 🏫

Automatización de registro de apoderados para colegios administrados por el SLEP.

## ¿Qué hace?
Permite subir archivos (CSV, XLSX, PDF, ODS) con datos de apoderados nuevos,
mapea las columnas automáticamente usando IA, y genera un Excel maestro
organizado por curso (Pre-Kinder a 8°B).

## Stack
- **Backend:** Python + FastAPI + pandas + pdfplumber
- **Frontend:** React + Vite + TailwindCSS
- **Mapeo inteligente:** sentence-transformers (local) + Anthropic API (fallback)

## Instalación

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # agregar ANTHROPIC_API_KEY
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno
Ver `backend/.env.example`
