import { useState } from 'react'

const API_URL = 'http://localhost:8000'

const COLUMN_LABELS = {
  nombre_alumno: 'Nombre Alumno',
  nombre_apoderado: 'Nombre Apoderado',
  correo_apoderado: 'Correo Apoderado',
  telefono_1: 'Teléfono 1',
  telefono_2: 'Teléfono 2',
}

const COLUMN_KEYS = Object.keys(COLUMN_LABELS)

export default function PreviewTable({ records, curso, mappingMode, onConfirmed }) {
  const [data, setData] = useState(records.map(r => ({ ...r })))
  const [editingCell, setEditingCell] = useState(null) // { row, col }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getBadge = () => {
    switch (mappingMode) {
      case 'local':
        return { emoji: '🟢', text: 'Procesado en local', bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-700' }
      case 'api-fallback':
        return { emoji: '🟡', text: 'Procesado con API (fallback)', bg: 'bg-yellow-50', border: 'border-yellow-200', color: 'text-yellow-700' }
      case 'api':
        return { emoji: '🔵', text: 'Procesado con API', bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-700' }
      default:
        return null
    }
  }

  const badge = getBadge()

  const handleCellClick = (rowIdx, colKey) => {
    setEditingCell({ row: rowIdx, col: colKey })
  }

  const handleCellChange = (rowIdx, colKey, value) => {
    setData(prev => {
      const updated = [...prev]
      updated[rowIdx] = { ...updated[rowIdx], [colKey]: value }
      return updated
    })
  }

  const handleCellBlur = () => {
    setEditingCell(null)
  }

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingCell(null)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      // Navegar a la siguiente celda
      if (editingCell) {
        const currentColIdx = COLUMN_KEYS.indexOf(editingCell.col)
        let nextColIdx = currentColIdx + 1
        let nextRow = editingCell.row
        if (nextColIdx >= COLUMN_KEYS.length) {
          nextColIdx = 0
          nextRow = nextRow + 1
        }
        if (nextRow < data.length) {
          setEditingCell({ row: nextRow, col: COLUMN_KEYS[nextColIdx] })
        } else {
          setEditingCell(null)
        }
      }
    }
  }

  const handleDeleteRow = (rowIdx) => {
    setData(prev => prev.filter((_, i) => i !== rowIdx))
  }

  const handleConfirm = async () => {
    if (data.length === 0) {
      setError('No hay registros para agregar.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso, records: data }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Error al confirmar los datos')
      }

      onConfirmed(result.message)
    } catch (err) {
      setError(err.message || 'Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            📋 Vista previa — {curso}
          </h3>
          {badge && (
            <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${badge.bg} ${badge.border} ${badge.color}`}>
              {badge.emoji} {badge.text}
            </span>
          )}
          <p className="text-sm text-slate-500 mt-1">
            {data.length} registro(s) encontrado(s). Haz clic en una celda para editarla.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 bg-azul-100 text-azul-800 text-sm font-semibold rounded-full">
          {data.length} alumno(s)
        </span>
      </div>

      {/* Tabla editable */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-azul-700 to-azul-800">
              <th className="px-3 py-3 text-left text-white font-semibold text-xs uppercase tracking-wider w-10">
                #
              </th>
              {COLUMN_KEYS.map((key) => (
                <th
                  key={key}
                  className="px-3 py-3 text-left text-white font-semibold text-xs uppercase tracking-wider"
                >
                  {COLUMN_LABELS[key]}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-white font-semibold text-xs uppercase tracking-wider w-16">
                ✕
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b border-slate-100 ${
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                } hover:bg-azul-50 transition-colors`}
              >
                <td className="px-3 py-2 text-slate-400 font-mono text-xs">
                  {rowIdx + 1}
                </td>
                {COLUMN_KEYS.map((key) => (
                  <td
                    key={key}
                    className="px-1 py-1 editable-cell"
                    onClick={() => handleCellClick(rowIdx, key)}
                  >
                    {editingCell?.row === rowIdx && editingCell?.col === key ? (
                      <input
                        type="text"
                        value={row[key] || ''}
                        onChange={(e) => handleCellChange(rowIdx, key, e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        autoFocus
                        className="w-full px-2 py-1.5 text-sm border-2 border-azul-400 rounded-lg
                                   bg-white focus:outline-none focus:border-azul-500 focus:ring-2 focus:ring-azul-100"
                      />
                    ) : (
                      <div className="px-2 py-1.5 rounded-lg cursor-text min-h-[32px] flex items-center
                                      hover:bg-azul-100 transition-colors text-slate-700">
                        {row[key] || <span className="text-slate-300 italic">vacío</span>}
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleDeleteRow(rowIdx)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors"
                    title="Eliminar fila"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No hay registros. Se eliminaron todos los datos.
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm fade-in">
          <span className="text-lg">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Botón confirmar */}
      <button
        onClick={handleConfirm}
        disabled={loading || data.length === 0}
        className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-base
                   transition-all duration-200 flex items-center justify-center gap-3
                   ${loading || data.length === 0
                     ? 'bg-slate-300 cursor-not-allowed'
                     : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-200 hover:shadow-xl hover:shadow-green-300 active:scale-[0.98]'
                   }`}
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Guardando registros...
          </>
        ) : (
          <>
            ✅ Confirmar y agregar al Excel
          </>
        )}
      </button>
    </div>
  )
}
