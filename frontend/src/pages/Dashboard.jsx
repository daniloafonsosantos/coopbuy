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
import { getStats } from '../api/client'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'

const fmt = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStats()
      .then((r) => setStats(r.data))
      .catch(() => setError('Não foi possível carregar os dados. Verifique se o backend está rodando.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner text="Carregando dashboard..." />

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-4xl">⚠️</p>
        <p className="text-red-500 text-sm text-center max-w-sm">{error}</p>
      </div>
    )

  // Use chart_markets (excludes catch-all "Desconhecido") when available
  const chartData = [...(stats.chart_markets || stats.markets_stats || [])].sort(
    (a, b) => a.avg_price - b.avg_price
  )
  const sorted = chartData
  const cheapest = sorted[0]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Visão geral do comparador de preços
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="🏷️" title="Produtos" value={stats.total_products} color="emerald" />
        <StatCard icon="🏪" title="Mercados" value={stats.total_markets} color="blue" />
        <StatCard icon="🧾" title="Cupons Processados" value={stats.total_receipts} color="purple" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Comparação de Preços por Mercado
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Preço médio dos produtos em cada mercado
            </p>
          </div>
          {cheapest && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg shrink-0">
              🏆 {cheapest.market}: {fmt(cheapest.avg_price)}
            </span>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-5xl mb-3">📊</p>
            <p className="text-gray-500 font-medium">Sem dados disponíveis ainda</p>
            <p className="text-gray-400 text-sm mt-1">
              Envie um cupom fiscal para começar a comparar preços
            </p>
          </div>
        ) : sorted.length === 1 ? (
          <div className="text-center py-14">
            <p className="text-5xl mb-3">🏪</p>
            <p className="text-gray-500 font-medium">Apenas 1 mercado identificado</p>
            <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
              Envie cupons de outros mercados para ativar a comparação de preços.
              Mercado atual: <strong>{sorted[0].market}</strong> — preço médio {fmt(sorted[0].avg_price)}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sorted} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                {sorted.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#059669' : '#60a5fa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {sorted.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sorted.map((m, i) => (
              <span
                key={m.market}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  i === 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {i === 0 && '🏆 '}
                {m.market}: {fmt(m.avg_price)}
                <span className="text-gray-400 font-normal">
                  ({m.price_count} itens)
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Getting started card */}
      {stats.total_receipts === 0 && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
          <h2 className="font-bold text-lg">Pronto para começar? 🚀</h2>
          <p className="text-emerald-100 text-sm mt-1 max-w-lg">
            Tire uma foto do cupom fiscal e envie pelo menu{' '}
            <strong className="text-white">Enviar Cupom</strong>. A IA extrai os
            produtos automaticamente e começa a comparação de preços.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center max-w-sm">
            {[
              { emoji: '📷', label: '1. Foto do cupom' },
              { emoji: '🤖', label: '2. IA extrai dados' },
              { emoji: '📊', label: '3. Compare preços' },
            ].map(({ emoji, label }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-lg p-3">
                <p className="text-2xl">{emoji}</p>
                <p className="text-xs mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
