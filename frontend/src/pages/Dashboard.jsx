import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Wallet, DollarSign, TrendingDown, Calendar } from 'lucide-react'
import { useSummary } from '../hooks/useSummary'
import { getTransactions } from '../api/transactions'
import StatCard from '../components/StatCard'
import DonutChart from '../components/DonutChart'
import LineChartComponent from '../components/LineChart'
import TransactionTable from '../components/TransactionTable'

const fmt = (v) =>
  v != null ? `$${parseFloat(v).toFixed(2)}` : '—'
const fmtPEN = (v) =>
  v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '—'

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useSummary()

  const { data: txAll } = useQuery({
    queryKey: ['transactions-all'],
    queryFn: () => getTransactions({ limit: 500 }).then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: txRecent } = useQuery({
    queryKey: ['transactions-recent'],
    queryFn: () => getTransactions({ limit: 10 }).then((r) => r.data),
    staleTime: 30_000,
  })

  // DonutChart: current month transactions grouped by category
  const donutData = useMemo(() => {
    if (!txAll) return []
    const monthStart = startOfMonth(new Date())
    const monthTx = txAll.filter(
      (tx) => parseISO(tx.transaction_date) >= monthStart
    )
    const map = {}
    monthTx.forEach((tx) => {
      const name = tx.category?.name ?? 'Otros'
      const color = tx.category?.color ?? '#94a3b8'
      if (!map[name]) map[name] = { name, value: 0, color }
      map[name].value += parseFloat(tx.amount_usd)
    })
    return Object.values(map).sort((a, b) => b.value - a.value)
  }, [txAll])

  // LineChart: cumulative spending last 30 days
  const lineData = useMemo(() => {
    if (!txAll) return []
    const now = new Date()
    const cutoff = subDays(now, 30)
    const dailyMap = {}
    txAll
      .filter((tx) => parseISO(tx.transaction_date) >= cutoff)
      .forEach((tx) => {
        const key = format(parseISO(tx.transaction_date), 'dd/MM')
        dailyMap[key] = (dailyMap[key] ?? 0) + parseFloat(tx.amount_usd)
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
    return `${fecha} (${summary.proyeccion_dias_restantes} días)`
  }, [summary])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Saldo actual USD"
          value={loadingSummary ? '…' : fmt(summary?.saldo_actual_usd)}
          iconClass="text-indigo-400"
        />
        <StatCard
          icon={DollarSign}
          label="Saldo actual PEN"
          value={loadingSummary ? '…' : fmtPEN(summary?.saldo_actual_pen)}
          subtitle={summary?.saldo_actual_pen ? 'Último TC registrado' : 'Sin TC registrado'}
          iconClass="text-emerald-400"
        />
        <StatCard
          icon={TrendingDown}
          label="Gasto este mes"
          value={loadingSummary ? '…' : fmt(summary?.gasto_mes_actual_usd)}
          subtitle={`Promedio diario: ${fmt(summary?.gasto_promedio_diario_usd)}`}
          iconClass="text-amber-400"
        />
        <StatCard
          icon={Calendar}
          label="Proyección agotamiento"
          value={loadingSummary ? '…' : proyeccionLabel}
          subtitle={`Desde inicio: ${summary?.dias_desde_inicio ?? 0} días`}
          iconClass="text-rose-400"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Gastos por categoría — mes actual
          </h2>
          <DonutChart data={donutData} />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Gasto acumulado — últimos 30 días
          </h2>
          <LineChartComponent data={lineData} />
        </div>
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
