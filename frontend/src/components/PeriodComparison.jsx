import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { getSummary } from '../api/summary'

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '12px',
}

const PERIODS = [
  { value: 'week', label: 'Esta semana vs anterior' },
  { value: 'month', label: 'Este mes vs anterior' },
]

export default function PeriodComparison() {
  const [period, setPeriod] = useState('month')

  const { data } = useQuery({
    queryKey: ['summary-compare', period],
    queryFn: () =>
      getSummary({ compare: true, period }).then((r) => r.data),
    staleTime: 30_000,
  })

  const currentStats = data?.periodo_actual
  const previousStats = data?.periodo_anterior
  const variation = data?.variacion_porcentual ?? {}

  const allCats = currentStats
    ? Object.keys({ ...currentStats.por_categoria, ...previousStats?.por_categoria })
    : []

  const chartData = allCats.map((cat) => ({
    name: cat.length > 12 ? cat.slice(0, 12) + '…' : cat,
    fullName: cat,
    actual: parseFloat(currentStats?.por_categoria[cat] ?? 0).toFixed(2),
    anterior: parseFloat(previousStats?.por_categoria[cat] ?? 0).toFixed(2),
    variacion: variation[cat] ?? 0,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Comparación de períodos</h2>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          Sin datos suficientes para comparar
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${v}`} width={56} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => [`S/ ${parseFloat(v).toFixed(2)}`, name === 'actual' ? 'Período actual' : 'Período anterior']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
              />
              <Legend
                formatter={(v) => (
                  <span className="text-xs text-slate-400">
                    {v === 'actual' ? 'Período actual' : 'Período anterior'}
                  </span>
                )}
              />
              <Bar dataKey="anterior" fill="#334155" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Variation table */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {chartData.map((d) => (
              <div key={d.fullName} className="bg-slate-900 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-400 truncate">{d.fullName}</p>
                <p
                  className={`text-sm font-semibold mt-0.5 ${
                    d.variacion > 0 ? 'text-rose-400' : d.variacion < 0 ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {d.variacion > 0 ? '↑' : d.variacion < 0 ? '↓' : '→'} {Math.abs(d.variacion)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
