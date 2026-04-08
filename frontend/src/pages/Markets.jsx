import { useEffect, useState } from 'react'
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
import { getMarkets, getStats } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Markets() {
  const [markets, setMarkets] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMarkets(), getStats()])
      .then(([m, s]) => {
        setMarkets(m.data)
        setStats(s.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner text="Carregando mercados..." />

  const marketStatsMap = Object.fromEntries(
    (stats?.markets_stats || []).map((m) => [m.market, m])
  )
  const sorted = [...(stats?.chart_markets || stats?.markets_stats || [])].sort(
    (a, b) => a.avg_price - b.avg_price
  )
  const cheapestName = sorted[0]?.market

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mercados</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {markets.length} mercado{markets.length !== 1 ? 's' : ''} cadastrado{markets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Empty state */}
      {markets.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-5xl mb-3">🏪</p>
          <p className="text-gray-600 font-medium">Nenhum mercado ainda</p>
          <p className="text-gray-400 text-sm mt-1">
            Os mercados são detectados automaticamente ao enviar um cupom fiscal
          </p>
        </div>
      )}

      {markets.length > 0 && (
        <>
          {/* Comparison chart (only when 1+ markets have price data) */}
          {sorted.length >= 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-base font-semibold text-gray-900">
                Preço Médio por Mercado
              </h2>
              <p className="text-sm text-gray-400 mt-0.5 mb-5">
                Mercado com menor preço médio é o mais barato no geral
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={sorted}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="market"
                    tick={{ fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmt}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v) => [fmt(v), 'Preço Médio']}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="avg_price" radius={[8, 8, 0, 0]}>
                    {sorted.map((item, i) => (
                      <Cell key={i} fill={i === 0 ? '#059669' : '#60a5fa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Market cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((m) => {
              const ms = marketStatsMap[m.name]
              const isCheapest = m.name === cheapestName && sorted.length >= 2

              return (
                <div
                  key={m.id}
                  className={`bg-white rounded-xl shadow-sm border p-5 transition-shadow hover:shadow-md ${
                    isCheapest ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">🏪</span>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {m.name}
                        </h3>
                      </div>
                      {(m.city || m.state) && (
                        <p className="text-xs text-gray-400 mt-1 ml-8">
                          {[m.city, m.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    {isCheapest && (
                      <span className="shrink-0 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        🏆 Mais barato
                      </span>
                    )}
                  </div>

                  {ms ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Média', value: fmt(ms.avg_price), cls: 'text-gray-900' },
                        { label: 'Mínimo', value: fmt(ms.min_price), cls: 'text-emerald-600' },
                        { label: 'Máximo', value: fmt(ms.max_price), cls: 'text-gray-600' },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                            {label}
                          </p>
                          <p className={`text-sm font-bold mt-0.5 ${cls}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-4">
                      Sem preços registrados
                    </p>
                  )}

                  {ms && (
                    <p className="text-xs text-gray-400 mt-3">
                      {ms.price_count} preço{ms.price_count !== 1 ? 's' : ''} registrado{ms.price_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
