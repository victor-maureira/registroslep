"""
main.py — FastAPI application for RegistroSlep.
Endpoints: POST /upload, POST /confirm, GET /download.
"""

import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from parser import extract_content
from mapper import map_columns
from excel_manager import add_records, get_master_path, load_or_create_master, CURSOS

app = FastAPI(
    title="RegistroSlep API",
    description="API para automatizar la gestión de datos de apoderados en colegios SLEP",
    version="1.0.0",
)

# CORS para Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConfirmRequest(BaseModel):
    """Datos confirmados por el usuario para agregar al Excel."""
    curso: str
    records: list[dict]


@app.get("/")
def root():
    """Endpoint de salud."""
    return {"status": "ok", "app": "RegistroSlep", "version": "1.0.0"}


@app.get("/cursos")
def get_cursos():
    """Retorna la lista de cursos válidos."""
    return {"cursos": CURSOS}


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    curso: str = Form(...),
):
    """
    Recibe un archivo + curso.
    Extrae el contenido, lo mapea con IA, y retorna los datos para previsualización.
    """
    # Validar curso
    if curso not in CURSOS:
        raise HTTPException(
            status_code=400,
            detail=f"Curso no válido: {curso}. Cursos válidos: {CURSOS}"
        )

    # Validar extensión
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed_extensions = {"csv", "xlsx", "xls", "ods", "pdf"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: .{ext}. Formatos válidos: {', '.join(allowed_extensions)}"
        )

    # Leer archivo
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer el archivo: {e}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    # Extraer contenido
    try:
        raw_content = extract_content(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not raw_content or not raw_content.strip():
        raise HTTPException(
            status_code=400,
            detail="No se pudo extraer contenido del archivo. Verifica que no esté vacío o dañado."
        )

    # Mapear columnas con IA
    try:
        mapped_data, mapping_mode = map_columns(raw_content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not mapped_data:
        raise HTTPException(
            status_code=422,
            detail="No se encontraron datos de apoderados en el archivo."
        )

    return {
        "status": "success",
        "message": "Datos extraídos correctamente. Revisa y confirma.",
        "curso": curso,
        "records": mapped_data,
        "total": len(mapped_data),
        "mapping_mode": mapping_mode,
    }


@app.post("/confirm")
async def confirm_records(request: ConfirmRequest):
    """
    Recibe los datos editados por el usuario y los escribe en el Excel maestro.
    """
    # Validar curso
    if request.curso not in CURSOS:
        raise HTTPException(
            status_code=400,
            detail=f"Curso no válido: {request.curso}"
        )

    if not request.records:
        raise HTTPException(
            status_code=400,
            detail="No hay registros para agregar."
        )

    # Agregar al Excel maestro
    try:
        filepath = add_records(request.curso, request.records)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al escribir en el Excel: {e}"
        )

    return {
        "status": "success",
        "message": f"¡{len(request.records)} registro(s) agregado(s) correctamente al curso {request.curso}!",
        "total_added": len(request.records),
    }


@app.get("/download")
async def download_excel():
    """
    Descarga el Excel maestro con FileResponse.
    """
    filepath = get_master_path()
    if not filepath:
        # Crear el archivo vacío si no existe
        filepath = load_or_create_master()

    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=404,
            detail="El archivo Excel maestro no existe aún."
        )

    return FileResponse(
        path=filepath,
        filename="registro_maestro.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
