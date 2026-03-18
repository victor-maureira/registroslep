const API_URL = 'http://localhost:8000'

export default function DownloadButton() {
  const handleDownload = async () => {
    try {
      const response = await fetch(`${API_URL}/download`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Error al descargar el archivo')
      }

      // Descargar como blob
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'registro_maestro.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al descargar: ' + (err.message || 'Error desconocido'))
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full py-4 px-6 rounded-xl text-white font-semibold text-base
                 bg-gradient-to-r from-azul-700 to-azul-800 hover:from-azul-800 hover:to-azul-900
                 shadow-lg shadow-azul-200 hover:shadow-xl hover:shadow-azul-300
                 transition-all duration-200 active:scale-[0.98]
                 flex items-center justify-center gap-3"
    >
      📥 Descargar Excel Maestro
    </button>
  )
}
