import { useRef, useState, useEffect, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Camera, ScanLine, Upload as UploadIcon, CheckCircle,
  AlertCircle, X, ArrowRight, DollarSign, ShoppingBag, RotateCcw,
  Image as ImageIcon, PenLine, MapPin, Loader,
} from 'lucide-react'
import { uploadReceipt, lookupBarcode, saveBarcodePrice, getMarkets, scanBarcodeFromImage } from '../api/client'

const fmt = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Tab 1: Foto do Cupom ───────────────────────────────────────────────────
function TabReceipt() {
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

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await uploadReceipt(file)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao processar o cupom.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null); setResult(null); setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {!preview && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all select-none ${
            dragging ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
          }`}
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <Camera size={30} className="text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">Clique para selecionar ou arraste</p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG, WEBP — foto do cupom fiscal</p>
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      )}

      {preview && !result && (
        <div className="relative rounded-2xl overflow-hidden shadow-md bg-gray-100">
          <img src={preview} alt="Cupom" className="w-full object-contain max-h-80" />
          <button onClick={clear}
            className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow-md text-gray-600">
            <X size={18} />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/30 to-transparent p-3">
            <p className="text-white text-sm font-medium truncate">{file?.name}</p>
          </div>
        </div>
      )}

      {file && !result && (
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 text-sm">
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando com IA...
            </>
          ) : (
            <><UploadIcon size={18} /> Enviar e Processar Cupom</>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`flex items-start gap-3 px-4 py-4 rounded-xl border ${
            result.status === 'processed' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}>
            {result.status === 'processed'
              ? <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              : <AlertCircle size={20} className="text-amber-500 mt-0.5 shrink-0" />}
            <div>
              <p className={`font-semibold text-sm ${result.status === 'processed' ? 'text-emerald-800' : 'text-amber-800'}`}>
                {result.status === 'processed' ? 'Cupom processado!' : 'Nenhum produto detectado'}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>📍 Mercado: <strong>{result.market || 'Não identificado'}</strong></li>
                <li>🏷️ Produtos: <strong>{result.products_count}</strong></li>
                <li>🧾 Cupom: <strong>#{result.receipt_id}</strong></li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={clear}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50">
              Enviar outro
            </button>
            <a href="/products"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-1.5">
              Ver produtos <ArrowRight size={15} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Código de Barras ────────────────────────────────────────────────
function TabBarcode() {
  const [scanning, setScanning] = useState(false)
  const [product, setProduct] = useState(null)
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [code, setCode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [market, setMarket] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [regName, setRegName] = useState('')
  const [regBrand, setRegBrand] = useState('')
  const [regCategory, setRegCategory] = useState('')
  const [markets, setMarkets] = useState([])
  const [locating, setLocating] = useState(false)
  const html5QrRef = useRef(null)
  const photoInputRef = useRef(null)

  useEffect(() => {
    getMarkets().then((r) => setMarkets(r.data)).catch(() => {})
  }, [])

  const detectNearbyMarket = useCallback(async () => {
    if (!navigator.geolocation) { setError('Geolocalização não suportada neste navegador.'); return }
    setLocating(true)
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
      )
      const { latitude: lat, longitude: lon } = pos.coords
      // Overpass API: supermercados num raio de 500m
      const query = `[out:json][timeout:10];(node["shop"~"supermarket|convenience|grocery"](around:700,${lat},${lon});way["shop"~"supermarket|convenience|grocery"](around:700,${lat},${lon}););out center 5;`
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: `data=${encodeURIComponent(query)}`
      })
      const data = await r.json()
      const elements = data.elements || []
      if (elements.length === 0) { setError('Nenhum supermercado encontrado num raio de 500m.'); return }
      // Pega o mais próximo (primeiro resultado do Overpass já é o mais próximo)
      const nome = elements[0].tags?.name || elements[0].tags?.['brand:pt'] || elements[0].tags?.brand || 'Supermercado'
      setMarket(nome)
    } catch (e) {
      if (e.code === 1) setError('Permissão de localização negada.')
      else if (e.code === 3) setError('Tempo esgotado ao obter localização.')
      else setError('Não foi possível detectar o mercado próximo.')
    } finally {
      setLocating(false)
    }
  }, [])

  const startScanner = async () => {
    setError(null); setProduct(null); setPrices([]); setSaveResult(null)
    setScanning(true)
    await new Promise((r) => setTimeout(r, 100))
    const scanner = new Html5Qrcode('barcode-reader')
    html5QrRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 140 }, aspectRatio: 1.5 },
        (decoded) => { scanner.stop().catch(() => {}); setScanning(false); handleCode(decoded) },
        () => {}
      )
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
      setScanning(false)
    }
  }

  const stopScanner = () => {
    html5QrRef.current?.stop().catch(() => {})
    setScanning(false)
  }

  const scanFromPhoto = async (file) => {
    setError(null); setProduct(null); setPrices([]); setSaveResult(null); setNotFound(false)

    // Passo 1: tenta ler o código via JS (rápido, sem rede)
    let codigoLido = null
    try {
      const scanner = new Html5Qrcode('barcode-photo-scanner')
      codigoLido = await scanner.scanFile(file, false)
    } catch { /* JS não conseguiu — vai para Vision */ }

    if (!codigoLido) {
      // Passo 2: Vision extrai o número da foto
      setLoading(true)
      try {
        const res = await scanBarcodeFromImage(file)
        if (res.data.found && res.data.code) {
          codigoLido = res.data.code
        }
      } catch (err) {
        setLoading(false)
        const detail = err?.response?.data?.detail || err?.message || 'falha desconhecida'
        setError(`Erro ao processar foto: ${detail}`)
        return
      }
      setLoading(false)
    }

    if (!codigoLido) {
      setError('Não foi possível ler o código de barras da foto. Tente escanear ao vivo ou digitar o código.')
      return
    }

    // Coloca o código no campo e busca — igual a digitar e clicar em Buscar
    setManualCode(codigoLido)
    handleCode(codigoLido)
  }

  const handleCode = async (barcode) => {
    setCode(barcode); setLoading(true); setError(null)
    setProduct(null); setPrices([]); setSaveResult(null); setNotFound(false)
    try {
      const res = await lookupBarcode(barcode)
      if (!res.data.found) {
        setNotFound(true)
      } else {
        setProduct(res.data.product)
        setPrices(res.data.prices || [])
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao buscar o produto')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePrice = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await saveBarcodePrice(code, {
        price: parseFloat(price),
        market,
        name: product.name,
        brand: product.brand,
        category: product.category,
        image_url: product.image_url,
      })
      setSaveResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao salvar preço')
    } finally {
      setSaving(false)
    }
  }

  const handleRegisterSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await saveBarcodePrice(code, {
        price: parseFloat(price),
        market,
        name: regName.trim(),
        brand: regBrand.trim() || undefined,
        category: regCategory.trim() || undefined,
        image_url: null,
      })
      setSaveResult(res.data)
      setNotFound(false)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setProduct(null); setPrices([]); setCode(''); setManualCode('')
    setError(null); setSaveResult(null); setPrice(''); setMarket('')
    setNotFound(false); setRegName(''); setRegBrand(''); setRegCategory('')
  }

  return (
    <div className="space-y-4">
      {!product && !loading && (
        <>
          {scanning ? (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <div id="barcode-reader" className="w-full" />
              <button onClick={stopScanner}
                className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow-md text-gray-600 z-10">
                <X size={18} />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="text-white text-sm text-center font-medium">Aponte para o código de barras...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={startScanner}
                className="py-10 border-2 border-dashed border-gray-300 rounded-2xl hover:border-emerald-400 hover:bg-gray-50 transition-all flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                  <ScanLine size={26} className="text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-700 text-sm">Escanear ao vivo</p>
                  <p className="text-xs text-gray-400 mt-1">Câmera em tempo real</p>
                </div>
              </button>

              <button onClick={() => photoInputRef.current?.click()}
                className="py-10 border-2 border-dashed border-gray-300 rounded-2xl hover:border-sky-400 hover:bg-sky-50 transition-all flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center">
                  <ImageIcon size={26} className="text-sky-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-700 text-sm">Tirar foto</p>
                  <p className="text-xs text-gray-400 mt-1">Mais estável</p>
                </div>
              </button>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) scanFromPhoto(e.target.files[0]); e.target.value = '' }}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OU DIGITE O CÓDIGO</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (manualCode.trim()) handleCode(manualCode.trim()) }}
            className="flex gap-2">
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 7894900011517"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button type="submit" disabled={!manualCode.trim()}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl text-sm">
              Buscar
            </button>
          </form>
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">
            {code ? <>Buscando <strong>{code}</strong>...</> : 'Analisando imagem com IA...'}
          </p>
          <p className="text-xs text-gray-400">
            {code ? 'Consultando múltiplas bases de dados' : 'Identificando produto e código de barras'}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Não encontrado</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
          <button onClick={reset} className="text-red-400 hover:text-red-600"><RotateCcw size={16} /></button>
        </div>
      )}

      {notFound && !loading && !saveResult && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Produto não encontrado</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Código <span className="font-mono font-semibold">{code}</span> não está em nenhuma base de dados.
                Preencha abaixo para cadastrá-lo!
              </p>
            </div>
            <button onClick={reset} className="text-amber-400 hover:text-amber-600"><RotateCcw size={16} /></button>
          </div>

          <form onSubmit={handleRegisterSave}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <PenLine size={16} className="text-amber-500" /> Cadastrar produto
            </p>

            <div>
              <label className="text-xs text-gray-500 font-medium">Nome do produto <span className="text-red-400">*</span></label>
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ex: Coca-Cola 2L"
                className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-medium">Marca</label>
                <input
                  value={regBrand}
                  onChange={(e) => setRegBrand(e.target.value)}
                  placeholder="Ex: Coca-Cola"
                  className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Categoria</label>
                <input
                  value={regCategory}
                  onChange={(e) => setRegCategory(e.target.value)}
                  placeholder="Ex: Bebidas"
                  className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar preço</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Mercado <span className="text-red-400">*</span></label>
                  <div className="flex gap-2 mt-1">
                    <input
                      list="market-list-reg"
                      value={market}
                      onChange={(e) => setMarket(e.target.value)}
                      placeholder="Nome do mercado"
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                    <button type="button" onClick={detectNearbyMarket} disabled={locating}
                      title="Detectar mercado pela localização"
                      className="px-3 py-2.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 rounded-lg text-amber-700 flex items-center gap-1 text-xs font-medium shrink-0">
                      {locating ? <Loader size={14} className="animate-spin" /> : <MapPin size={14} />}
                      {locating ? '' : 'GPS'}
                    </button>
                  </div>
                  <datalist id="market-list-reg">
                    {markets.map((m) => <option key={m.id} value={m.name} />)}
                  </datalist>
                  <p className="text-xs text-gray-400 mt-1">Nomes parecidos são unificados automaticamente</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Preço (R$) <span className="text-red-400">*</span></label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving || !regName.trim() || !price || !market}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
                : <><ShoppingBag size={16} /> Cadastrar e Salvar Preço</>}
            </button>
          </form>
        </div>
      )}

      {saveResult && notFound === false && !product && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Produto cadastrado e preço salvo!</p>
              <p className="text-sm text-emerald-600 mt-0.5">
                {fmt(price)} em <strong>{saveResult.market}</strong>
              </p>
            </div>
          </div>
          <button onClick={reset}
            className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
            <ScanLine size={16} /> Escanear outro produto
          </button>
        </div>
      )}

      {product && !loading && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex gap-4 p-4">
              <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                {product.image_url
                  ? <img src={product.image_url} alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none' }} />
                  : <span className="text-4xl">🛒</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight">{product.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {product.brand && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{product.brand}</span>
                  )}
                  {product.category && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{product.category}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2 font-mono">{code}</p>
              </div>
            </div>

            {prices.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Preços registrados
                </p>
                <ul className="space-y-1.5">
                  {prices.map((p, i) => (
                    <li key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        {i === 0 && <span>🏆</span>}{p.market}
                      </span>
                      <span className={`font-bold ${i === 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {fmt(p.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {!saveResult ? (
            <form onSubmit={handleSavePrice}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-600" /> Registrar preço
              </p>
              <div>
                <label className="text-xs text-gray-500 font-medium">Mercado</label>
                <div className="flex gap-2 mt-1">
                  <input
                    list="market-list-bc"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    placeholder="Nome do mercado"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    required
                  />
                  <button type="button" onClick={detectNearbyMarket} disabled={locating}
                    title="Detectar mercado pela localização"
                    className="px-3 py-2.5 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg text-emerald-700 flex items-center gap-1 text-xs font-medium shrink-0">
                    {locating ? <Loader size={14} className="animate-spin" /> : <MapPin size={14} />}
                    {locating ? '' : 'GPS'}
                  </button>
                </div>
                <datalist id="market-list-bc">
                  {markets.map((m) => <option key={m.id} value={m.name} />)}
                </datalist>
                <p className="text-xs text-gray-400 mt-1">
                  Nomes parecidos são unificados automaticamente
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Preço (R$)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  required
                />
              </div>
              <button type="submit" disabled={saving || !price || !market}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
                  : <><ShoppingBag size={16} /> Salvar Preço</>}
              </button>
            </form>
          ) : (
            <div className="flex items-start gap-3 px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Preço salvo!</p>
                <p className="text-sm text-emerald-600 mt-0.5">
                  {fmt(price)} em <strong>{saveResult.market}</strong>
                </p>
                {saveResult.market !== market && (
                  <p className="text-xs text-emerald-500 mt-1">
                    Nome normalizado: "{market}" → "{saveResult.market}"
                  </p>
                )}
              </div>
            </div>
          )}

          <button onClick={reset}
            className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
            <ScanLine size={16} /> Escanear outro produto
          </button>
        </div>
      )}

      {/* Always in DOM so Html5Qrcode can reference it for scanFile() */}
      <div id="barcode-photo-scanner" className="hidden" />
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Upload() {
  const [tab, setTab] = useState('receipt')

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Registrar Preço</h1>
        <p className="text-gray-500 text-sm mt-1">
          Envie um cupom fiscal ou escaneie o código de barras de um produto
        </p>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('receipt')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'receipt' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Camera size={16} /> Foto do Cupom
        </button>
        <button
          onClick={() => setTab('barcode')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'barcode' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ScanLine size={16} /> Código de Barras
        </button>
      </div>

      {tab === 'receipt' ? <TabReceipt /> : <TabBarcode />}
    </div>
  )
}
