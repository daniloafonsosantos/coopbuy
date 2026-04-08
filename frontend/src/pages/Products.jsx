import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { getProducts } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import PriceModal from '../components/PriceModal'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [imgErrors, setImgErrors] = useState({})

  useEffect(() => {
    getProducts(0, 200)
      .then((r) => setProducts(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.normalized_name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    )
  })

  if (loading) return <LoadingSpinner text="Carregando produtos..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, categoria…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent w-full sm:w-72"
          />
        </div>
      </div>

      {/* Empty states */}
      {products.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-5xl mb-3">🏷️</p>
          <p className="text-gray-600 font-medium">Nenhum produto ainda</p>
          <p className="text-gray-400 text-sm mt-1">
            Envie um cupom fiscal para extrair produtos automaticamente
          </p>
        </div>
      )}

      {products.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-600 font-medium">
            Nenhum resultado para "{search}"
          </p>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
              onClick={() => setSelected(p)}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-50 overflow-hidden flex items-center justify-center">
                {p.image_url && !imgErrors[p.id] ? (
                  <img
                    src={p.image_url}
                    alt={p.normalized_name}
                    className="w-full h-full object-cover"
                    onError={() =>
                      setImgErrors((prev) => ({ ...prev, [p.id]: true }))
                    }
                  />
                ) : (
                  <span className="text-5xl select-none">🛒</span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2.5rem]">
                  {p.normalized_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.category && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
                      {p.category}
                    </span>
                  )}
                </div>
                <button className="mt-2.5 w-full py-1.5 text-xs text-emerald-600 font-medium border border-emerald-200 rounded-lg group-hover:bg-emerald-50 transition-colors">
                  Ver preços →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <PriceModal product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
