import { useRef, useState } from 'react'
import { Upload as UploadIcon, Camera, CheckCircle, AlertCircle, X, ArrowRight } from 'lucide-react'
import { uploadReceipt } from '../api/client'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await uploadReceipt(file)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao processar o cupom. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enviar Cupom</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fotografe ou selecione a imagem do cupom fiscal para extração automática
        </p>
      </div>

      {/* Drop zone */}
      {!preview && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all select-none ${
            dragging
              ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
              : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
          }`}
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <Camera size={30} className="text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">
              Clique para selecionar ou arraste aqui
            </p>
            <p className="text-sm text-gray-400 mt-1">
              JPG, PNG, WEBP — foto do cupom fiscal
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div className="relative rounded-2xl overflow-hidden shadow-md bg-gray-100">
          <img
            src={preview}
            alt="Cupom selecionado"
            className="w-full object-contain max-h-80"
          />
          <button
            onClick={clear}
            className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md text-gray-600 hover:text-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/30 to-transparent p-3">
            <p className="text-white text-sm font-medium truncate">{file?.name}</p>
          </div>
        </div>
      )}

      {/* Submit button */}
      {file && !result && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 text-sm"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando com IA — pode levar alguns segundos…
            </>
          ) : (
            <>
              <UploadIcon size={18} />
              Enviar e Processar Cupom
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Erro ao processar</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div
            className={`flex items-start gap-3 px-4 py-4 rounded-xl border ${
              result.status === 'processed'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            {result.status === 'processed' ? (
              <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${result.status === 'processed' ? 'text-emerald-800' : 'text-amber-800'}`}>
                {result.status === 'processed'
                  ? 'Cupom processado com sucesso!'
                  : 'Cupom enviado — nenhum produto detectado'}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li className="flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Mercado: <strong>{result.market || 'Não identificado'}</strong></span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span>Produtos extraídos: <strong>{result.products_count}</strong></span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>🧾</span>
                  <span>ID do cupom: <strong>#{result.receipt_id}</strong></span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={clear}
              className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Enviar outro cupom
            </button>
            <a
              href="/products"
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              Ver produtos
              <ArrowRight size={15} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
