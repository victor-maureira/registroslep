"""
mapper.py — Mapeo inteligente de columnas.
Soporta dos modos controlados por la variable de entorno MAPPING_MODE:
  - "api"   → usa la API de Anthropic (Claude) para mapear columnas.
  - "local" → usa sentence-transformers para mapear columnas localmente.
"""

import json
import os
import re

import anthropic


# ─── Prompt para modo API ───────────────────────────────────────────

MAPPING_PROMPT = """Eres un asistente que extrae datos de apoderados escolares chilenos.
Dado el siguiente contenido extraído de un archivo, identifica y devuelve
SOLO un JSON array donde cada objeto tiene exactamente estas claves:
nombre_alumno, nombre_apoderado, correo_apoderado, telefono_1, telefono_2.
Si un campo no existe, usa null. No incluyas explicaciones, solo el JSON.
No envuelvas el JSON en bloques de código markdown (```json ... ```).
Responde ÚNICAMENTE con el JSON array, nada más."""


# ─── Esquema estándar con descripciones semánticas (modo local) ─────

STANDARD_SCHEMA = {
    "nombre_alumno": (
        "nombre completo del estudiante alumno niño menor pupilo educando "
        "nom est nombre del niño nombre niña student name student full name "
        "apellidos y nombre nombre y apellidos nombre estudiante"
    ),
    "nombre_apoderado": (
        "nombre del apoderado tutor padre madre guardian apod tutor legal "
        "apoderado titular responsable guardian name nombre tutor "
        "nombre apoderado nombre del tutor nombre del padre nombre de la madre"
    ),
    "correo_apoderado": (
        "correo electrónico email mail e-mail correo tutor "
        "email apoderado correo apoderado guardian email email address "
        "dirección correo electrónico"
    ),
    "telefono_1": (
        "teléfono móvil celular cel fono contacto móvil telefono principal "
        "cel apoderado teléfono apoderado mobile phone phone number "
        "número de contacto número celular número móvil"
    ),
    "telefono_2": (
        "teléfono secundario teléfono fijo fono hogar tel segundo teléfono "
        "teléfono casa fono fijo home phone second phone "
        "teléfono alternativo número fijo número de casa"
    ),
}

SIMILARITY_THRESHOLD = 0.3


# ─── Función pública (punto de entrada) ────────────────────────────


def map_columns(raw_content: str) -> tuple[list[dict], str]:
    """
    Mapea el contenido raw a las columnas estándar.
    Usa el modo definido por MAPPING_MODE (default: "api").
    Retorna una tupla (records, mapping_mode) donde mapping_mode es:
      - "local"        → se usó mapeo local y la calidad fue aceptable.
      - "api"          → se usó la API desde el inicio.
      - "api-fallback" → el mapeo local fue de baja calidad y se reintentó con API.
    """
    mode = os.environ.get("MAPPING_MODE", "api").strip().lower()

    if mode == "local":
        records = _map_columns_local(raw_content)

        if _check_quality(records):
            return records, "local"

        # Fallback: calidad insuficiente → reintentar con API
        print("⚠️ Mapeo local de baja calidad, reintentando con API...")

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "Mapeo local fallido. Configura ANTHROPIC_API_KEY en el .env "
                "para usar la API como respaldo en casos complejos."
            )

        return _map_columns_api(raw_content), "api-fallback"
    else:
        return _map_columns_api(raw_content), "api"


# ─── Modo API (Anthropic / Claude) ─────────────────────────────────


def _map_columns_api(raw_content: str) -> list[dict]:
    """Envía el contenido raw a Claude para mapear a las columnas estándar."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "No se encontró la variable de entorno ANTHROPIC_API_KEY. "
            "Configúrala antes de usar el mapeo con IA."
        )

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": f"{MAPPING_PROMPT}\n\nContenido del archivo:\n{raw_content}",
            }
        ],
    )

    response_text = message.content[0].text.strip()

    # Limpiar posibles envolturas de código markdown que el LLM podría agregar
    response_text = _strip_markdown_fences(response_text)

    # Parsear el JSON con manejo de errores
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"La IA no devolvió un JSON válido. Error: {e}\n"
            f"Respuesta recibida:\n{response_text[:500]}"
        )

    if not isinstance(data, list):
        raise ValueError("La IA no devolvió un JSON array como se esperaba.")

    return _normalize_records(data)


# ─── Modo Local (sentence-transformers) ────────────────────────────


def _map_columns_local(raw_content: str) -> list[dict]:
    """
    Mapea columnas localmente usando similitud semántica con
    sentence-transformers (model: paraphrase-multilingual-MiniLM-L12-v2).

    Pasos:
      1. Parsear raw_content en un DataFrame con pandas.
      2. Hacer matching semántico SOLO sobre los headers (nombres de columna).
      3. Extraer los valores de las columnas mapeadas del DataFrame.
    """
    import pandas as pd

    # 1. Parsear raw_content en un DataFrame
    df = _parse_raw_content_to_df(raw_content)

    if df is None or df.empty:
        raise ValueError(
            "No se pudieron extraer datos tabulares del contenido. "
            "Intenta con MAPPING_MODE=api para archivos complejos."
        )

    # 2. Cargar modelo y calcular embeddings
    model = _get_sentence_model()

    schema_keys = list(STANDARD_SCHEMA.keys())
    schema_descriptions = list(STANDARD_SCHEMA.values())

    # Embeddings de las descripciones del esquema
    schema_embeddings = model.encode(schema_descriptions, normalize_embeddings=True)

    # Embeddings SOLO de los headers (nombres de columna del archivo)
    headers = [str(col).strip() for col in df.columns]
    header_embeddings = model.encode(headers, normalize_embeddings=True)

    # 3. Calcular similitud coseno y asignar mejores coincidencias
    # (header_embeddings @ schema_embeddings.T) → matriz de similitudes
    similarity_matrix = header_embeddings @ schema_embeddings.T

    # Greedy matching: ordenar por score descendente, asignar sin duplicados
    column_mapping = {}  # schema_key → nombre de columna del archivo
    used_columns = set()

    scores = []
    for col_idx in range(len(headers)):
        for schema_idx in range(len(schema_keys)):
            scores.append((
                float(similarity_matrix[col_idx][schema_idx]),
                col_idx,
                schema_idx,
            ))

    scores.sort(reverse=True)

    for score, col_idx, schema_idx in scores:
        schema_key = schema_keys[schema_idx]
        col_name = df.columns[col_idx]

        if schema_key in column_mapping or col_name in used_columns:
            continue
        if score < SIMILARITY_THRESHOLD:
            continue

        column_mapping[schema_key] = col_name
        used_columns.add(col_name)

    # 4. Construir los registros extrayendo valores del DataFrame
    records = []
    for _, row in df.iterrows():
        record = {}
        for key in schema_keys:
            if key in column_mapping:
                val = row[column_mapping[key]]
                record[key] = None if pd.isna(val) else val
            else:
                record[key] = None
        records.append(record)

    return records


# ─── Parseo robusto de raw_content ──────────────────────────────────


def _parse_raw_content_to_df(raw_content: str):
    """
    Parsea el raw_content (generado por parser.py) de vuelta a un DataFrame.

    El raw_content puede tener múltiples secciones separadas por marcadores
    como '--- Hoja: NombreHoja ---' o '--- Tabla página N ---'.
    Cada sección es el resultado de df.to_string(index=False), que produce
    texto alineado con ancho fijo (fixed-width formatted).
    """
    import pandas as pd

    # Separar secciones (pueden ser hojas de Excel, tablas de PDF, etc.)
    section_pattern = r"---\s*(?:Hoja|Tabla página|Texto página)[^-]*---"
    sections = re.split(section_pattern, raw_content)

    all_dfs = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        df = _try_parse_section(section)
        if df is not None and not df.empty:
            all_dfs.append(df)

    if not all_dfs:
        return None

    # Concatenar todos los DataFrames (alinea por nombre de columna)
    result = pd.concat(all_dfs, ignore_index=True)
    return result


def _try_parse_section(text: str):
    """
    Intenta parsear una sección de texto como datos tabulares.
    Prueba estrategias en orden: CSV, fixed-width, TSV, punto y coma.
    """
    import io
    import pandas as pd

    lines = [line for line in text.split("\n") if line.strip()]
    if len(lines) < 2:
        return None

    # Estrategia 1: CSV con StringIO (la más común)
    try:
        df = pd.read_csv(io.StringIO(text))
        if len(df.columns) >= 2 and len(df) >= 1:
            return df
    except Exception:
        pass

    # Estrategia 2: Fixed-width format (output de df.to_string)
    try:
        df = pd.read_fwf(io.StringIO(text))
        if len(df.columns) >= 2 and len(df) >= 1:
            return df
    except Exception:
        pass

    # Estrategia 3: TSV (separado por tabulaciones)
    try:
        df = pd.read_csv(io.StringIO(text), sep="\t")
        if len(df.columns) >= 2 and len(df) >= 1:
            return df
    except Exception:
        pass

    # Estrategia 4: Separado por punto y coma (común en Excel latinoamericano)
    try:
        df = pd.read_csv(io.StringIO(text), sep=";")
        if len(df.columns) >= 2 and len(df) >= 1:
            return df
    except Exception:
        pass

    return None


# ─── Modelo sentence-transformers (singleton) ──────────────────────

_sentence_model = None


def _get_sentence_model():
    """Carga el modelo de sentence-transformers (lazy singleton)."""
    global _sentence_model
    if _sentence_model is None:
        from sentence_transformers import SentenceTransformer

        _sentence_model = SentenceTransformer(
            "paraphrase-multilingual-MiniLM-L12-v2"
        )
    return _sentence_model


# ─── Validación de calidad ──────────────────────────────────────────


def _check_quality(records: list[dict]) -> bool:
    """
    Verifica si los registros mapeados son de calidad aceptable.
    Retorna True si la calidad es buena, False si es mala.

    Criterios de mala calidad (cualquiera dispara False):
      1. >50% de los registros tienen nombre_alumno como None o vacío.
      2. Algún nombre_alumno contiene solo dígitos (ej: "912341001").
      3. >60% de los campos totales de todos los registros son None.
    """
    if not records:
        return False

    total_records = len(records)
    expected_keys = list(STANDARD_SCHEMA.keys())
    total_fields = total_records * len(expected_keys)

    none_names = 0
    none_fields = 0

    for record in records:
        nombre = record.get("nombre_alumno")

        # Criterio 1: nombre_alumno es None o vacío
        if nombre is None or str(nombre).strip() == "":
            none_names += 1
        else:
            # Criterio 2: nombre_alumno contiene solo dígitos
            if re.fullmatch(r"\d+", str(nombre).strip()):
                return False

        # Criterio 3: contar campos None
        for key in expected_keys:
            if record.get(key) is None:
                none_fields += 1

    # Criterio 1: más del 50% de nombres vacíos/None
    if none_names / total_records > 0.5:
        return False

    # Criterio 3: más del 60% de campos totales son None
    if none_fields / total_fields > 0.6:
        return False

    return True


# ─── Utilidades compartidas ─────────────────────────────────────────


def _normalize_records(data: list) -> list[dict]:
    """Valida y normaliza las claves esperadas en cada registro."""
    expected_keys = list(STANDARD_SCHEMA.keys())
    normalized = []
    for item in data:
        row = {}
        for key in expected_keys:
            row[key] = item.get(key)
        normalized.append(row)
    return normalized


def _strip_markdown_fences(text: str) -> str:
    """
    Elimina envolturas de código markdown como ```json ... ``` o ``` ... ```.
    Los LLMs a veces devuelven el JSON envuelto en bloques de código.
    """
    # Patrón para ```json\n...\n``` o ```\n...\n```
    pattern = r"^```(?:json)?\s*\n?(.*?)\n?\s*```$"
    match = re.match(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text
