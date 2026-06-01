import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Save } from 'lucide-react'
import { format, addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { getProjectionParams, updateProjectionParams } from '../api/projection'
import { getCategories, createCategory, deleteCategory } from '../api/categories'
import { useSummary } from '../hooks/useSummary'

function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-base font-semibold text-slate-200 mb-4">{title}</h2>
      {children}
    </div>
  )
}

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

  const promedio = parseFloat(summary?.gasto_promedio_diario_usd ?? 0)
  const saldo = parseFloat(summary?.saldo_actual_usd ?? 0)

  const gastoAjustado = promedio * (1 + adj / 100)
  const diasRestantes = gastoAjustado > 0 ? Math.floor(saldo / gastoAjustado) : null
  const fechaAgotamiento =
    diasRestantes != null
      ? format(addDays(new Date(), diasRestantes), "d 'de' MMMM yyyy", { locale: es })
      : '—'

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProjectionParams({
        adjustment_percentage: adj.toFixed(2),
        notes: notes || null,
      })
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
            <p className="text-xs text-slate-400 mb-0.5">Promedio diario (30d)</p>
            <p className="text-lg font-semibold text-slate-100">
              ${promedio.toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-0.5">Gasto ajustado/día</p>
            <p className="text-lg font-semibold text-indigo-400">
              ${gastoAjustado.toFixed(2)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              Ajuste de gasto
            </label>
            <span
              className={`text-sm font-semibold tabular-nums ${
                adj > 0 ? 'text-rose-400' : adj < 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {adj > 0 ? '+' : ''}{adj}%
            </span>
          </div>
          <input
            type="range"
            min="-50"
            max="100"
            step="1"
            value={adj}
            onChange={(e) => setAdj(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-slate-700 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>-50%</span>
            <span>0%</span>
            <span>+100%</span>
          </div>
        </div>

        <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-1">Con este ajuste el fondo dura hasta</p>
          <p className="text-xl font-bold text-indigo-300">{fechaAgotamiento}</p>
          {diasRestantes != null && (
            <p className="text-sm text-slate-400 mt-0.5">{diasRestantes} días restantes</p>
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
      const msg = err.response?.data?.detail ?? 'No se puede eliminar'
      alert(msg)
    }
  }

  return (
    <Section title="Categorías">
      <div className="space-y-4">
        <div className="divide-y divide-slate-700/50">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 py-2.5">
              <span
                className="w-4 h-4 rounded shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-slate-200">{cat.name}</span>
              {cat.is_default && (
                <span className="text-xs text-slate-500">predeterminada</span>
              )}
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
          <input
            {...register('name', { required: true })}
            placeholder="Nueva categoría"
            className="field flex-1"
          />
          <input
            {...register('color')}
            type="color"
            className="w-10 h-10 rounded-lg border border-slate-600 bg-slate-900 cursor-pointer p-1"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Section>
  )
}

export default function Settings() {
  const { data: summary } = useSummary()

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100">Configuración</h1>

      <Section title="Fondo de emergencias">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-0.5">Balance inicial</p>
            <p className="text-lg font-semibold text-slate-100">
              ${parseFloat(summary?.saldo_actual_usd ?? 0 + (summary?.gasto_total_usd ?? 0)).toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-0.5">Saldo actual</p>
            <p className="text-2xl font-bold text-emerald-400">
              ${parseFloat(summary?.saldo_actual_usd ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          El saldo se actualiza automáticamente al registrar transacciones.
        </p>
      </Section>

      <ProjectionSection summary={summary} />

      <CategoriesSection />
    </div>
  )
}
