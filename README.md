# RegistroSlep 🏫

> **ES** | [EN below](#english-version)

Herramienta web para automatizar el registro de apoderados en colegios administrados por el **SLEP** (Servicio Local de Educación Pública) en Chile.

---

## El problema a resolver

Mi mamá trabaja en un colegio administrado por el SLEP. Cada semana recibía archivos con datos de apoderados nuevos generados por el sistema de matrícula — en distintos formatos y con columnas nombradas de formas distintas cada vez.

El proceso manual era:
1. Imprimir el archivo
2. Leer cada fila
3. Transcribir los datos a mano en un Excel maestro organizado por curso

**Tiempo perdido: ~3 horas semanales.**

El problema no era solo el tiempo — era que los archivos llegaban con columnas inconsistentes: a veces `"Apoderado Titular"`, otras `"Tutor Legal"`, otras `"Nombre del Apoderado"`. Todos significan lo mismo, pero para una persona transcribiendo manualmente eso genera errores y confusión.

Lo identifiqué como un problema automatizable y construí RegistroSlep.

**Resultado: de 3 horas a menos de 1 minuto por archivo.**

---

## ¿Qué hace?

```
[Archivo subido: CSV / XLSX / PDF / ODS]
          ↓
[Backend extrae el contenido del archivo]
          ↓
[IA mapea automáticamente las columnas al esquema estándar]
          ↓
[Vista previa editable — el usuario valida o corrige]
          ↓
[Excel maestro actualizado con una hoja por curso]
          ↓
[Descarga automática]
```

### Funcionalidades principales
- Acepta archivos **CSV, XLSX, XLS, ODS y PDF**
- Mapeo inteligente de columnas — entiende nombres distintos para el mismo campo
- Vista previa editable antes de confirmar cualquier cambio
- Excel maestro con **18 hojas** (Pre-Kinder → 8°B), numeración automática por curso
- **Backup automático** con timestamp antes de cada modificación
- Badge visual que indica si el procesamiento fue local o con API

---

## Arquitectura y lógica

El proyecto está dividido en dos partes independientes que se comunican entre sí:

### Backend (Python + FastAPI)
Responsable de toda la lógica de datos:

| Archivo | Responsabilidad |
|---|---|
| `parser.py` | Detecta el tipo de archivo y extrae su contenido como texto estructurado |
| `mapper.py` | Mapea las columnas del archivo al esquema estándar usando IA |
| `excel_manager.py` | Lee, modifica y guarda el Excel maestro con backups automáticos |
| `main.py` | API REST con 3 endpoints: `/upload`, `/confirm`, `/download` |

### Frontend (React + Vite)
Interfaz simple de 3 pasos:
1. **Subir archivo** — selector de curso + drag & drop
2. **Revisar datos** — tabla editable con los datos mapeados
3. **Descargar** — Excel maestro actualizado

### Flujo del mapeo inteligente
El corazón del proyecto. Los archivos del sistema SLEP llegan con columnas inconsistentes. En vez de escribir reglas hardcodeadas para cada posible nombre de columna, se usa IA para entender el **significado** de cada columna:

```
"Tutor Legal" → nombre_apoderado  ✓
"Apoderado Titular" → nombre_apoderado  ✓
"Cel. Apoderado" → telefono_1  ✓
"Nom. Est." → nombre_alumno  ✓ (via fallback API)
```

---

## Stack y por qué cada tecnología

| Tecnología | Rol | Por qué |
|---|---|---|
| **Python + FastAPI** | Backend / API REST | Ecosistema ideal para procesamiento de datos, rápido de desarrollar |
| **pandas** | Lectura de archivos | Maneja CSV, Excel y ODS con una sola librería |
| **pdfplumber** | Extracción de PDF | Extrae tablas y texto de PDFs generados por sistemas externos |
| **openpyxl** | Escritura de Excel | Control total sobre hojas, celdas y formato del Excel maestro |
| **sentence-transformers** | Mapeo local de columnas | Modelo de lenguaje liviano (~470MB) que corre 100% offline |
| **Anthropic API (Claude)** | Fallback de mapeo | Usado solo cuando el mapeo local no alcanza la calidad mínima |
| **React + Vite** | Frontend | Interfaz rápida y reactiva, ideal para el flujo de 3 pasos |
| **TailwindCSS** | Estilos | Desarrollo de UI ágil sin CSS personalizado |

---

## Decisiones técnicas

### Modo local vs API — privacidad de datos de menores

El mapeo de columnas inicialmente usaba directamente la API de Anthropic (Claude). Un colega señaló un punto válido: **los archivos contienen datos personales de menores de edad**, y enviarlos a servidores externos es una práctica cuestionable aunque la API de Anthropic no los use para entrenar modelos ni los almacene de forma persistente.

La solución fue implementar **dos modos de mapeo**:

- **Modo local** (`sentence-transformers`): corre completamente offline en el PC. Los datos nunca salen del equipo. Es el modo por defecto.
- **Modo API** (`Anthropic Claude Sonnet`): se usa solo como fallback cuando el modo local produce resultados de baja calidad.

### Fallback automático

El modo local falla en casos extremos — columnas muy abreviadas como `"Nom. Est."` o `"Cel."`. Se implementó un sistema de detección de calidad que evalúa el resultado del mapeo local y, si no cumple los criterios mínimos, llama automáticamente a la API sin intervención del usuario.

La interfaz muestra un badge indicando cómo fue procesado cada archivo:
- 🟢 Procesado en local
- 🟡 Procesado con API (fallback)
- 🔵 Procesado con API

### Excel como base de datos

Se optó por mantener un archivo Excel como almacenamiento en vez de una base de datos, porque el flujo de trabajo del colegio ya está construido alrededor de Excel. La mejor solución es la que se adapta al usuario, no la que obliga al usuario a adaptarse.

---

## Instalación

### Requisitos
- Python 3.10+
- Node.js 18+

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Editar .env y agregar ANTHROPIC_API_KEY (solo necesaria para el fallback)
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` en el navegador.

### Variables de entorno
```env
ANTHROPIC_API_KEY=sk-ant-...   # Solo para fallback. Opcional si usas solo modo local.
MAPPING_MODE=local              # "local" o "api"
```

---

---

## English version

### RegistroSlep 🏫

A web tool to automate guardian data registration for schools managed by the **SLEP** (Chile's Local Public Education Service).

**The problem:** A school secretary received weekly files with new guardian data — in different formats, with inconsistently named columns — and had to manually transcribe everything into a master Excel file. ~3 hours per week, every week.

**The solution:** Upload the file → AI maps the columns automatically → review an editable preview → download the updated Excel.

**Result: from 3 hours to under 1 minute per file.**

### Key decisions
- **Local-first AI mapping** using `sentence-transformers` — data never leaves the machine, protecting minors' personal data
- **Automatic API fallback** to Anthropic Claude when local quality is insufficient
- **Excel as storage** — adapts to the existing workflow instead of forcing a new one

### Stack
`Python` · `FastAPI` · `pandas` · `openpyxl` · `pdfplumber` · `sentence-transformers` · `Anthropic API` · `React` · `Vite` · `TailwindCSS`
