import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { ShieldAlert, User, Wallet, TrendingDown, Calendar } from 'lucide-react'
import { useSummary } from '../hooks/useSummary'
import { getTransactions } from '../api/transactions'
import { getExchangeRates } from '../api/exchangeRates'
import StatCard from '../components/StatCard'
import DonutChart from '../components/DonutChart'
import LineChartComponent from '../components/LineChart'
import PeriodComparison from '../components/PeriodComparison'
import TransactionTable from '../components/TransactionTable'

const fmtUSD = (v) => (v != null ? `$${parseFloat(v).toFixed(2)}` : '—')
const fmtPEN = (v) => (v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '—')

export default function Dashboard() {
  const { data: summary, isLoading } = useSummary()

  const { data: txAll = [] } = useQuery({
    queryKey: ['transactions-all'],
    queryFn: () => getTransactions({ limit: 500 }).then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: txRecent = [] } = useQuery({
    queryKey: ['transactions-recent'],
    queryFn: () => getTransactions({ limit: 10 }).then((r) => r.data),
    staleTime: 30_000,
  })

  // DonutChart: PEN expenses current month by category
  const donutData = useMemo(() => {
    const monthStart = startOfMonth(new Date())
    const map = {}
    txAll
      .filter((tx) => tx.type === 'expense' && parseISO(tx.transaction_date) >= monthStart)
      .forEach((tx) => {
        const name = tx.category?.name ?? 'Otros'
        const color = tx.category?.color ?? '#94a3b8'
        if (!map[name]) map[name] = { name, value: 0, color }
        map[name].value += parseFloat(tx.amount_pen ?? 0)
      })
    return Object.values(map).sort((a, b) => b.value - a.value)
  }, [txAll])

  // LineChart: cumulative PEN expenses last 30 days
  const lineData = useMemo(() => {
    const now = new Date()
    const cutoff = subDays(now, 30)
    const dailyMap = {}
    txAll
      .filter((tx) => tx.type === 'expense' && parseISO(tx.transaction_date) >= cutoff)
      .forEach((tx) => {
        const key = format(parseISO(tx.transaction_date), 'dd/MM')
        dailyMap[key] = (dailyMap[key] ?? 0) + parseFloat(tx.amount_pen ?? 0)
      })
    let cumulative = 0
    return Array.from({ length: 30 }, (_, i) => {
      const d = subDays(now, 29 - i)
      const key = format(d, 'dd/MM')
      cumulative += dailyMap[key] ?? 0
      return { date: key, acumulado: parseFloat(cumulative.toFixed(2)) }
    })
  }, [txAll])

  const proyeccionLabel = useMemo(() => {
    if (!summary?.proyeccion_agotamiento) return 'Sin datos'
    const fecha = format(parseISO(summary.proyeccion_agotamiento), "d 'de' MMMM yyyy", { locale: es })
    return `${fecha} (${summary.proyeccion_dias_restantes}d)`
  }, [summary])

  const fondos = summary?.funds ?? []
  const emergencia = fondos.find((f) => f.name === 'Emergencia')
  const personal = fondos.find((f) => f.name === 'Personal')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={ShieldAlert}
          label="Fondo Emergencia"
          value={isLoading ? '…' : fmtUSD(emergencia?.current_balance_usd)}
          subtitle={emergencia ? `Inicial: ${fmtUSD(emergencia.initial_balance_usd)}` : undefined}
          iconClass="text-rose-400"
        />
        <StatCard
          icon={User}
          label="Fondo Personal"
          value={isLoading ? '…' : fmtUSD(personal?.current_balance_usd)}
          subtitle={personal ? `Inicial: ${fmtUSD(personal.initial_balance_usd)}` : undefined}
          iconClass="text-sky-400"
        />
        <StatCard
          icon={Wallet}
          label="Saldo PEN disponible"
          value={isLoading ? '…' : fmtPEN(summary?.pen_wallet_balance)}
          subtitle={
            summary?.ultimo_tipo_cambio
              ? `Último TC: ${parseFloat(summary.ultimo_tipo_cambio).toFixed(4)}`
              : 'Sin cambios registrados'
          }
          iconClass="text-emerald-400"
        />
        <StatCard
          icon={TrendingDown}
          label="Gasto este mes (PEN)"
          value={isLoading ? '…' : fmtPEN(summary?.gasto_mes_actual_pen)}
          subtitle={`Prom. diario: ${fmtPEN(summary?.gasto_promedio_diario_pen)}`}
          iconClass="text-amber-400"
        />
        <StatCard
          icon={Calendar}
          label="Proyección agotamiento"
          value={isLoading ? '…' : proyeccionLabel}
          subtitle={`USD total: ${fmtUSD(summary?.total_usd)}`}
          iconClass="text-indigo-400"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Gastos PEN por categoría — mes actual
          </h2>
          <DonutChart data={donutData} />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Gasto PEN acumulado — últimos 30 días
          </h2>
          <LineChartComponent data={lineData} />
        </div>
      </div>

      {/* Period comparison + TC history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <PeriodComparison />
        </div>
        <TCHistory />
      </div>

      {/* Recent transactions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">
          Últimas transacciones
        </h2>
        <TransactionTable transactions={txRecent} />
      </div>
    </div>
  )
}

function TCHistory() {
  const { data } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => getExchangeRates().then((r) => r.data),
    staleTime: 60_000,
  })

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-4">
        Historial de tipos de cambio
      </h2>
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Promedio', val: data.avg_rate },
            { label: 'Mínimo', val: data.min_rate },
            { label: 'Máximo', val: data.max_rate },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-900 rounded-lg p-2.5 text-center">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-base font-semibold text-slate-100 mt-0.5 tabular-nums">
                {val ? parseFloat(val).toFixed(4) : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-y-auto max-h-44">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-2 py-1.5 text-left text-slate-400 font-medium">Fecha</th>
              <th className="px-2 py-1.5 text-right text-slate-400 font-medium">TC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {data?.history?.slice(0, 20).map((h) => (
              <tr key={h.id} className="hover:bg-slate-700/20">
                <td className="px-2 py-1.5 text-slate-400">
                  {format(parseISO(h.date), 'dd/MM/yy', { locale: es })}
                </td>
                <td className="px-2 py-1.5 text-slate-200 text-right tabular-nums font-medium">
                  {parseFloat(h.rate).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.history?.length && (
          <p className="text-center text-slate-500 py-6 text-xs">Sin cambios registrados</p>
        )}
      </div>
    </div>
  )
}
