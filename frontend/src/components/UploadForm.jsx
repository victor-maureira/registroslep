import { useState } from 'react'

const API_URL = 'http://localhost:8000'

const CURSOS = [
  'Pre-Kinder', 'Kinder',
  '1°A', '1°B', '2°A', '2°B',
  '3°A', '3°B', '4°A', '4°B',
  '5°A', '5°B', '6°A', '6°B',
  '7°A', '7°B', '8°A', '8°B',
]

export default function UploadForm({ onDataReceived }) {
  const [curso, setCurso] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const allowedExtensions = ['.csv', '.xlsx', '.xls', '.ods', '.pdf']

  const validateFile = (f) => {
    if (!f) return false
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      setError(`Formato no soportado: ${ext}. Usa: ${allowedExtensions.join(', ')}`)
      return false
    }
    return true
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && validateFile(selected)) {
      setFile(selected)
      setError('')
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && validateFile(dropped)) {
      setFile(dropped)
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!curso) {
      setError('Selecciona un curso antes de continuar.')
      return
    }
    if (!file) {
      setError('Selecciona un archivo para procesar.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('curso', curso)

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error al procesar el archivo')
      }

      onDataReceived(data.records, curso, data.mapping_mode)
    } catch (err) {
      setError(err.message || 'Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selector de curso */}
        <div>
          <label
            htmlFor="curso-select"
            className="block text-sm font-semibold text-slate-700 mb-2"
          >
            📚 Curso
          </label>
          <select
            id="curso-select"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800
                       focus:border-azul-500 focus:ring-4 focus:ring-azul-100 focus:outline-none
                       transition-all duration-200 text-base font-medium appearance-none
                       cursor-pointer"
            disabled={loading}
          >
            <option value="">— Selecciona un curso —</option>
            {CURSOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Zona de subida de archivo */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            📄 Archivo de datos
          </label>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
              ${dragActive
                ? 'border-azul-500 bg-azul-50'
                : file
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-300 bg-slate-50 hover:border-azul-400 hover:bg-azul-50'
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.ods,.pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
            {file ? (
              <div className="space-y-2">
                <div className="text-3xl">✅</div>
                <p className="text-green-700 font-semibold">{file.name}</p>
                <p className="text-sm text-green-600">
                  {(file.size / 1024).toFixed(1)} KB — Listo para procesar
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-3xl">📁</div>
                <p className="text-slate-600 font-medium">
                  Arrastra un archivo aquí o <span className="text-azul-600 underline">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-slate-400">
                  Formatos: CSV, XLSX, XLS, ODS, PDF
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm fade-in">
            <span className="text-lg">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Botón de procesar */}
        <button
          type="submit"
          disabled={loading || !curso || !file}
          className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-base
                     transition-all duration-200 flex items-center justify-center gap-3
                     ${loading || !curso || !file
                       ? 'bg-slate-300 cursor-not-allowed'
                       : 'bg-gradient-to-r from-azul-700 to-azul-800 hover:from-azul-800 hover:to-azul-900 shadow-lg shadow-azul-200 hover:shadow-xl hover:shadow-azul-300 active:scale-[0.98]'
                     }`}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Procesando archivo...
            </>
          ) : (
            <>
              🚀 Procesar archivo
            </>
          )}
        </button>
      </form>
    </div>
  )
}
