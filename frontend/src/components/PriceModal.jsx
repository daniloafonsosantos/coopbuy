import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getProductPrices } from '../api/client'

const fmt = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PriceModal({ product, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProductPrices(product.normalized_name)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [product.normalized_name])

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {product.normalized_name}
            </h2>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {product.category && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {product.category}
                </span>
              )}
              {product.brand && product.brand !== 'Marca Desconhecida' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {product.brand}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {/* No data */}
        {!loading && (!data || data.prices.length === 0) && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm text-gray-400">Sem preços registrados ainda</p>
          </div>
        )}

        {/* Chart + list */}
        {!loading && data && data.prices.length > 0 && (
          <>
            {/* Cheapest highlight */}
            <div className="mb-4 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
                Mais barato
              </p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">
                {data.prices[0].market} — {fmt(data.prices[0].price)}
              </p>
            </div>

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.prices}
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="market"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmt}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  formatter={(v) => [fmt(v), 'Preço']}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                  {data.prices.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#059669' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Price list */}
            <ul className="mt-4 divide-y divide-gray-100">
              {data.prices.map((p, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center py-2.5"
                >
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="text-xs">🏆</span>
                    )}
                    <span className="text-sm text-gray-700">{p.market}</span>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      i === 0 ? 'text-emerald-600' : 'text-gray-600'
                    }`}
                  >
                    {fmt(p.price)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
