"""
parser.py — Extracción de contenido de archivos según su tipo.
Soporta: CSV, XLSX, XLS, ODS, PDF.
"""

import io
import pandas as pd
import pdfplumber


def extract_content(file_bytes: bytes, filename: str) -> str:
    """
    Extrae el contenido de un archivo como string legible.
    Este string se envía a la IA para mapeo de columnas.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "csv":
        return _extract_csv(file_bytes)
    elif ext in ("xlsx", "xls"):
        return _extract_excel(file_bytes, ext)
    elif ext == "ods":
        return _extract_ods(file_bytes)
    elif ext == "pdf":
        return _extract_pdf(file_bytes)
    else:
        raise ValueError(f"Formato de archivo no soportado: .{ext}")


def _extract_csv(file_bytes: bytes) -> str:
    """Extrae contenido de un CSV usando pandas."""
    # Intentar diferentes encodings comunes en Chile
    for encoding in ["utf-8", "latin-1", "iso-8859-1", "cp1252"]:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
            return df.to_csv(index=False)
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    raise ValueError("No se pudo leer el archivo CSV con ninguna codificación conocida.")


def _extract_excel(file_bytes: bytes, ext: str) -> str:
    """Extrae contenido de XLSX o XLS."""
    engine = "openpyxl" if ext == "xlsx" else "xlrd"
    try:
        # Leer todas las hojas
        sheets = pd.read_excel(io.BytesIO(file_bytes), engine=engine, sheet_name=None)
        parts = []
        for sheet_name, df in sheets.items():
            parts.append(f"--- Hoja: {sheet_name} ---")
            parts.append(df.to_csv(index=False))
        return "\n".join(parts)
    except Exception as e:
        raise ValueError(f"Error al leer archivo Excel: {e}")


def _extract_ods(file_bytes: bytes) -> str:
    """Extrae contenido de un archivo ODS."""
    try:
        sheets = pd.read_excel(io.BytesIO(file_bytes), engine="odf", sheet_name=None)
        parts = []
        for sheet_name, df in sheets.items():
            parts.append(f"--- Hoja: {sheet_name} ---")
            parts.append(df.to_csv(index=False))
        return "\n".join(parts)
    except Exception as e:
        raise ValueError(f"Error al leer archivo ODS: {e}")


def _extract_pdf(file_bytes: bytes) -> str:
    """
    Extrae contenido de un PDF.
    Primero intenta extraer tablas; si no encuentra, extrae texto completo.
    Claude puede inferir datos incluso de texto no estructurado.
    """
    try:
        all_content = []
        tables_found = False

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                if tables:
                    tables_found = True
                    for table in tables:
                        # Convertir tabla a DataFrame para formato legible
                        if table and len(table) > 1:
                            df = pd.DataFrame(table[1:], columns=table[0])
                            all_content.append(f"--- Tabla página {i + 1} ---")
                            all_content.append(df.to_string(index=False))

            # Si no se encontraron tablas, extraer texto completo como fallback
            if not tables_found:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        all_content.append(f"--- Texto página {i + 1} ---")
                        all_content.append(text.strip())

        if not all_content:
            raise ValueError("El PDF no contiene tablas ni texto extraíble.")

        return "\n".join(all_content)
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Error al leer archivo PDF: {e}")
