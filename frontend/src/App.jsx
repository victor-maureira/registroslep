import { useState } from 'react'
import UploadForm from './components/UploadForm'
import PreviewTable from './components/PreviewTable'
import DownloadButton from './components/DownloadButton'

// Estados del flujo
const STEP_UPLOAD = 'upload'
const STEP_PREVIEW = 'preview'
const STEP_DONE = 'done'

export default function App() {
  const [step, setStep] = useState(STEP_UPLOAD)
  const [records, setRecords] = useState([])
  const [curso, setCurso] = useState('')
  const [mappingMode, setMappingMode] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleDataReceived = (mappedRecords, selectedCurso, mode) => {
    setRecords(mappedRecords)
    setCurso(selectedCurso)
    setMappingMode(mode || 'local')
    setStep(STEP_PREVIEW)
  }

  const handleConfirmed = (message) => {
    setSuccessMessage(message)
    setStep(STEP_DONE)
  }

  const handleReset = () => {
    setStep(STEP_UPLOAD)
    setRecords([])
    setCurso('')
    setMappingMode('')
    setSuccessMessage('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-azul-800 to-azul-900 shadow-xl">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-xl">🏫</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  RegistroSlep
                </h1>
                <p className="text-xs sm:text-sm text-azul-200">
                  Gestión de datos de apoderados — SLEP
                </p>
              </div>
            </div>
            {step !== STEP_UPLOAD && (
              <button
                onClick={handleReset}
                className="text-sm text-azul-200 hover:text-white bg-white/10 hover:bg-white/20
                           px-4 py-2 rounded-lg transition-all duration-200 font-medium"
              >
                ← Nuevo registro
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Indicador de progreso */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            step === STEP_UPLOAD
              ? 'bg-azul-100 text-azul-800 shadow-sm'
              : 'bg-green-100 text-green-700'
          }`}>
            {step === STEP_UPLOAD ? '1️⃣' : '✅'} Subir archivo
          </span>
          <span className="text-slate-300">→</span>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            step === STEP_PREVIEW
              ? 'bg-azul-100 text-azul-800 shadow-sm'
              : step === STEP_DONE
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-400'
          }`}>
            {step === STEP_DONE ? '✅' : '2️⃣'} Revisar datos
          </span>
          <span className="text-slate-300">→</span>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            step === STEP_DONE
              ? 'bg-green-100 text-green-700 shadow-sm'
              : 'bg-slate-100 text-slate-400'
          }`}>
            {step === STEP_DONE ? '✅' : '3️⃣'} Descargar
          </span>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">

          {/* Paso 1: Subida de archivo */}
          {step === STEP_UPLOAD && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">
                  Cargar archivo de apoderados
                </h2>
                <p className="text-slate-500 mt-2">
                  Selecciona el curso y sube el archivo con los datos de los nuevos apoderados
                </p>
              </div>
              <UploadForm onDataReceived={handleDataReceived} />
            </div>
          )}

          {/* Paso 2: Vista previa */}
          {step === STEP_PREVIEW && (
            <PreviewTable
              records={records}
              curso={curso}
              mappingMode={mappingMode}
              onConfirmed={handleConfirmed}
            />
          )}

          {/* Paso 3: Éxito + Descarga */}
          {step === STEP_DONE && (
            <div className="slide-up space-y-8">
              {/* Mensaje de éxito */}
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-4xl">🎉</span>
                </div>
                <h3 className="text-2xl font-bold text-green-700">
                  ¡Registro agregado correctamente!
                </h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  {successMessage}
                </p>
              </div>

              {/* Botón de descarga */}
              <DownloadButton />

              {/* Botón para agregar más */}
              <div className="text-center">
                <button
                  onClick={handleReset}
                  className="text-azul-600 hover:text-azul-800 font-medium text-sm
                             underline underline-offset-4 transition-colors"
                >
                  ¿Agregar más datos? Haz clic aquí
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 pb-4">
          <p className="text-xs text-slate-400">
            RegistroSlep v1.0 — Automatización de datos SLEP
          </p>
        </footer>
      </main>
    </div>
  )
}
