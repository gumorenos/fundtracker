import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Save, Pencil, X } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getProjectionParams, updateProjectionParams } from '../api/projection'
import { getCategories, createCategory, deleteCategory } from '../api/categories'
import { getFunds, updateFundInitialBalance } from '../api/funds'
import { useSummary } from '../hooks/useSummary'

function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-base font-semibold text-slate-200 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ── Fund edit modal ────────────────────────────────────────────────────────────

function FundEditModal({ fund, onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: { initial_balance_usd: parseFloat(fund.initial_balance_usd) },
  })

  const onSubmit = async (data) => {
    const confirmed = window.confirm(
      '¿Estás seguro? Esto afectará el saldo actual del fondo.'
    )
    if (!confirmed) return
    await updateFundInitialBalance(fund.id, {
      initial_balance_usd: parseFloat(data.initial_balance_usd),
    })
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-100">
            Editar saldo inicial — {fund.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <p className="text-sm text-slate-400">
            Cambiar el saldo inicial recalculará el saldo actual manteniendo todos los movimientos históricos.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nuevo saldo inicial (USD)
            </label>
            <input
              {...register('initial_balance_usd', {
                required: 'Requerido',
                min: { value: 0.01, message: 'Debe ser mayor a 0' },
              })}
              type="number"
              step="0.01"
              className="field"
            />
            {errors.initial_balance_usd && (
              <p className="err">{errors.initial_balance_usd.message}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:text-slate-100 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Funds section ─────────────────────────────────────────────────────────────

function FundsSection() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const { data: funds = [] } = useQuery({
    queryKey: ['funds'],
    queryFn: () => getFunds().then((r) => r.data),
  })

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['funds'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
  }

  return (
    <Section title="Fondos">
      <div className="space-y-3">
        {funds.map((fund) => (
          <div
            key={fund.id}
            className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{fund.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Inicial: <span className="tabular-nums">${parseFloat(fund.initial_balance_usd).toFixed(2)}</span>
                {' · '}
                Actual: <span className="tabular-nums text-emerald-400">${parseFloat(fund.current_balance_usd).toFixed(2)}</span>
              </p>
            </div>
            <button
              onClick={() => setEditing(fund)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <FundEditModal
          fund={editing}
          onClose={() => setEditing(null)}
          onSuccess={handleSuccess}
        />
      )}
    </Section>
  )
}

// ── Projection section ────────────────────────────────────────────────────────

function ProjectionSection({ summary }) {
  const queryClient = useQueryClient()
  const { data: params } = useQuery({
    queryKey: ['projection-params'],
    queryFn: () => getProjectionParams().then((r) => r.data),
  })

  const [adj, setAdj] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (params) {
      setAdj(parseFloat(params.adjustment_percentage))
      setNotes(params.notes ?? '')
    }
  }, [params])

  const totalUsd = parseFloat(summary?.total_usd ?? 0)
  const usdPerDay = parseFloat(summary?.gasto_promedio_diario_pen ?? 0)

  // Re-derive usd/day from summary: we don't have it directly, use total/dias_restantes as approximation
  const diasActuales = summary?.proyeccion_dias_restantes ?? null

  const usdPerDayFromSummary =
    diasActuales && totalUsd > 0 ? totalUsd / diasActuales : 0

  const usdAjustado = usdPerDayFromSummary * (1 + adj / 100)
  const diasPreview = usdAjustado > 0 ? Math.floor(totalUsd / usdAjustado) : null
  const fechaPreview =
    diasPreview != null
      ? format(addDays(new Date(), diasPreview), "d 'de' MMMM yyyy", { locale: es })
      : '—'

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProjectionParams({ adjustment_percentage: adj.toFixed(2), notes: notes || null })
      queryClient.invalidateQueries({ queryKey: ['projection-params'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Proyección de agotamiento">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-0.5">Total USD disponible</p>
            <p className="text-lg font-semibold text-slate-100">${totalUsd.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-0.5">Días proyectados (con ajuste)</p>
            <p className="text-lg font-semibold text-indigo-400">
              {diasPreview != null ? diasPreview : '—'}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Ajuste de gasto</label>
            <span className={`text-sm font-semibold tabular-nums ${adj > 0 ? 'text-rose-400' : adj < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {adj > 0 ? '+' : ''}{adj}%
            </span>
          </div>
          <input
            type="range" min="-50" max="100" step="1"
            value={adj}
            onChange={(e) => setAdj(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-slate-700 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>-50%</span><span>0%</span><span>+100%</span>
          </div>
        </div>

        <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-1">Con este ajuste el fondo dura hasta</p>
          <p className="text-xl font-bold text-indigo-300">{fechaPreview}</p>
          {diasPreview != null && (
            <p className="text-sm text-slate-400 mt-0.5">{diasPreview} días restantes</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Motivo del ajuste…"
            className="field resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar ajuste'}
        </button>
      </div>
    </Section>
  )
}

// ── Categories section ────────────────────────────────────────────────────────

function CategoriesSection() {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: '', color: '#6366f1' },
  })

  const onAdd = async (data) => {
    await createCategory(data)
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    reset({ name: '', color: '#6366f1' })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await deleteCategory(id)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    } catch (err) {
      alert(err.response?.data?.detail ?? 'No se puede eliminar')
    }
  }

  return (
    <Section title="Categorías">
      <div className="space-y-4">
        <div className="divide-y divide-slate-700/50">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 py-2.5">
              <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm text-slate-200">{cat.name}</span>
              {cat.is_default && <span className="text-xs text-slate-500">predeterminada</span>}
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit(onAdd)} className="flex gap-2 pt-2">
          <input {...register('name', { required: true })} placeholder="Nueva categoría" className="field flex-1" />
          <input {...register('color')} type="color" className="w-10 h-10 rounded-lg border border-slate-600 bg-slate-900 cursor-pointer p-1" />
          <button
            type="submit" disabled={isSubmitting}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: summary } = useSummary()

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100">Configuración</h1>
      <FundsSection />
      <ProjectionSection summary={summary} />
      <CategoriesSection />
    </div>
  )
}
