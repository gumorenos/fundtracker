import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Save, Pencil, X, Copy, Check, Bell, BellOff } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getProjectionParams, updateProjectionParams } from '../api/projection'
import { getCategories, createCategory, deleteCategory } from '../api/categories'
import { getFunds, updateFundInitialBalance } from '../api/funds'
import { useSummary } from '../hooks/useSummary'
import { useAuth } from '../hooks/useAuth'
import {
  getMe, getUsers, setUserActive, changePassword,
  generateInvite, generateApiToken,
} from '../api/users'
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../api/alerts'

function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-base font-semibold text-slate-200 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-600 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ── Mi cuenta ─────────────────────────────────────────────────────────────────

function MyAccountSection() {
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => getMe().then(r => r.data) })
  const { register, handleSubmit, reset, formState: { isSubmitting, errors }, setError } = useForm()
  const [pwdSuccess, setPwdSuccess] = useState(false)

  const onPasswordChange = async (data) => {
    if (data.new_password !== data.confirm_password) {
      setError('confirm_password', { message: 'Las contraseñas no coinciden' })
      return
    }
    try {
      await changePassword({ current_password: data.current_password, new_password: data.new_password })
      reset()
      setPwdSuccess(true)
      setTimeout(() => setPwdSuccess(false), 3000)
    } catch (err) {
      setError('current_password', { message: err.response?.data?.detail ?? 'Error' })
    }
  }

  return (
    <Section title="Mi cuenta">
      <div className="space-y-4">
        {me && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-400">Usuario</p>
              <p className="text-sm font-medium text-slate-100 mt-0.5">{me.username}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-400">Miembro desde</p>
              <p className="text-sm font-medium text-slate-100 mt-0.5">
                {format(new Date(me.created_at), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Cambiar contraseña</p>
          <form onSubmit={handleSubmit(onPasswordChange)} className="space-y-3">
            <input
              {...register('current_password', { required: true })}
              type="password" placeholder="Contraseña actual" className="field"
            />
            {errors.current_password && <p className="err">{errors.current_password.message}</p>}
            <input
              {...register('new_password', { required: true, minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
              type="password" placeholder="Nueva contraseña" className="field"
            />
            {errors.new_password && <p className="err">{errors.new_password.message}</p>}
            <input
              {...register('confirm_password', { required: true })}
              type="password" placeholder="Confirmar nueva contraseña" className="field"
            />
            {errors.confirm_password && <p className="err">{errors.confirm_password.message}</p>}
            <button
              type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {pwdSuccess ? 'Guardado ✓' : isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </Section>
  )
}

// ── Fund edit modal ────────────────────────────────────────────────────────────

function FundEditModal({ fund, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm({
    defaultValues: { initial_balance_usd: parseFloat(fund.initial_balance_usd) },
  })
  const onSubmit = async (data) => {
    if (!window.confirm('¿Estás seguro? Esto afectará el saldo actual del fondo.')) return
    await updateFundInitialBalance(fund.id, { initial_balance_usd: parseFloat(data.initial_balance_usd) })
    onSuccess(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-100">Editar saldo inicial — {fund.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <p className="text-sm text-slate-400">Cambiar el saldo inicial recalculará el saldo actual manteniendo todos los movimientos históricos.</p>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nuevo saldo inicial (USD)</label>
            <input {...register('initial_balance_usd', { required: true, min: { value: 0.01, message: 'Debe ser mayor a 0' } })} type="number" step="0.01" className="field" />
            {errors.initial_balance_usd && <p className="err">{errors.initial_balance_usd.message}</p>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:text-slate-100 text-sm font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FundsSection() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const { data: funds = [] } = useQuery({ queryKey: ['funds'], queryFn: () => getFunds().then(r => r.data) })
  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['funds'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
  }
  return (
    <Section title="Fondos">
      <div className="space-y-3">
        {funds.map((fund) => (
          <div key={fund.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">{fund.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Inicial: <span className="tabular-nums">${parseFloat(fund.initial_balance_usd).toFixed(2)}</span>
                {' · '}
                Actual: <span className="tabular-nums text-emerald-400">${parseFloat(fund.current_balance_usd).toFixed(2)}</span>
              </p>
            </div>
            <button onClick={() => setEditing(fund)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </div>
        ))}
      </div>
      {editing && <FundEditModal fund={editing} onClose={() => setEditing(null)} onSuccess={handleSuccess} />}
    </Section>
  )
}

// ── Projection ────────────────────────────────────────────────────────────────

function ProjectionSection({ summary }) {
  const queryClient = useQueryClient()
  const { data: params } = useQuery({ queryKey: ['projection-params'], queryFn: () => getProjectionParams().then(r => r.data) })
  const [adj, setAdj] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (params) { setAdj(parseFloat(params.adjustment_percentage)); setNotes(params.notes ?? '') }
  }, [params])

  const totalUsd = parseFloat(summary?.total_usd ?? 0)
  const diasActuales = summary?.proyeccion_dias_restantes
  const usdPerDayBase = diasActuales && totalUsd > 0 ? totalUsd / diasActuales : 0
  const usdAjustado = usdPerDayBase * (1 + adj / 100)
  const diasPreview = usdAjustado > 0 ? Math.floor(totalUsd / usdAjustado) : null
  const fechaPreview = diasPreview != null ? format(addDays(new Date(), diasPreview), "d 'de' MMMM yyyy", { locale: es }) : '—'

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProjectionParams({ adjustment_percentage: adj.toFixed(2), notes: notes || null })
      queryClient.invalidateQueries({ queryKey: ['projection-params'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
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
            <p className="text-lg font-semibold text-indigo-400">{diasPreview ?? '—'}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Ajuste de gasto</label>
            <span className={`text-sm font-semibold tabular-nums ${adj > 0 ? 'text-rose-400' : adj < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {adj > 0 ? '+' : ''}{adj}%
            </span>
          </div>
          <input type="range" min="-50" max="100" step="1" value={adj} onChange={(e) => setAdj(parseInt(e.target.value))} className="w-full h-2 rounded-full appearance-none bg-slate-700 cursor-pointer" />
          <div className="flex justify-between text-xs text-slate-500 mt-1"><span>-50%</span><span>0%</span><span>+100%</span></div>
        </div>
        <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-lg p-4">
          <p className="text-sm text-slate-400 mb-1">Con este ajuste el fondo dura hasta</p>
          <p className="text-xl font-bold text-indigo-300">{fechaPreview}</p>
          {diasPreview != null && <p className="text-sm text-slate-400 mt-0.5">{diasPreview} días restantes</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Motivo del ajuste…" className="field resize-none" />
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          <Save className="w-4 h-4" />
          {saved ? 'Guardado ✓' : saving ? 'Guardando…' : 'Guardar ajuste'}
        </button>
      </div>
    </Section>
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

function CategoriesSection() {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data) })
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: { name: '', color: '#6366f1' } })
  const onAdd = async (data) => {
    await createCategory(data)
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    reset({ name: '', color: '#6366f1' })
  }
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try { await deleteCategory(id); queryClient.invalidateQueries({ queryKey: ['categories'] }) }
    catch (err) { alert(err.response?.data?.detail ?? 'No se puede eliminar') }
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
              <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit(onAdd)} className="flex gap-2 pt-2">
          <input {...register('name', { required: true })} placeholder="Nueva categoría" className="field flex-1" />
          <input {...register('color')} type="color" className="w-10 h-10 rounded-lg border border-slate-600 bg-slate-900 cursor-pointer p-1" />
          <button type="submit" disabled={isSubmitting} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Section>
  )
}

// ── Alerts ────────────────────────────────────────────────────────────────────

const ALERT_TYPES = {
  weekly_expense: 'Gasto semanal (PEN)',
  monthly_expense: 'Gasto mensual (PEN)',
  fund_balance: 'Saldo fondo (USD)',
}

function AlertsSection() {
  const queryClient = useQueryClient()
  const { data: alerts = [] } = useQuery({ queryKey: ['alerts'], queryFn: () => getAlerts().then(r => r.data) })
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({ defaultValues: { type: 'monthly_expense', threshold: '' } })

  const onAdd = async (data) => {
    await createAlert({ type: data.type, threshold: parseFloat(data.threshold) })
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    reset({ type: 'monthly_expense', threshold: '' })
  }

  const toggleActive = async (alert) => {
    await updateAlert(alert.id, { is_active: !alert.is_active })
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar alerta?')) return
    await deleteAlert(id)
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  return (
    <Section title="Alertas">
      <div className="space-y-4">
        {alerts.length === 0 && <p className="text-sm text-slate-500">Sin alertas configuradas</p>}
        <div className="divide-y divide-slate-700/50">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-3 py-3">
              <button onClick={() => toggleActive(alert)} className={`shrink-0 ${alert.is_active ? 'text-indigo-400' : 'text-slate-600'}`}>
                {alert.is_active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">{ALERT_TYPES[alert.type] ?? alert.type}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Umbral: <span className="tabular-nums">{parseFloat(alert.threshold).toFixed(2)}</span>
                  {alert.last_triggered && (
                    <span className="ml-2 text-amber-400">
                      Activada: {format(new Date(alert.last_triggered), 'dd/MM/yy', { locale: es })}
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => handleDelete(alert.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit(onAdd)} className="flex gap-2 pt-2">
          <select {...register('type')} className="field flex-1">
            {Object.entries(ALERT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input {...register('threshold', { required: true, min: 0.01 })} type="number" step="0.01" placeholder="Umbral" className="field w-28" />
          <button type="submit" disabled={isSubmitting} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Section>
  )
}

// ── Users (admin only) ────────────────────────────────────────────────────────

function UsersSection() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers().then(r => r.data) })
  const [invite, setInvite] = useState(null)
  const [apiToken, setApiToken] = useState(null)
  const [generatingToken, setGeneratingToken] = useState(null)

  const handleInvite = async () => {
    const res = await generateInvite()
    setInvite(res.data)
  }

  const handleApiToken = async (userId) => {
    setGeneratingToken(userId)
    try {
      const res = await generateApiToken({ user_id: userId })
      setApiToken({ userId, token: res.data.token })
    } finally { setGeneratingToken(null) }
  }

  const handleToggleActive = async (user) => {
    if (!confirm(`¿${user.is_active ? 'Desactivar' : 'Activar'} al usuario ${user.username}?`)) return
    await setUserActive(user.id, { is_active: !user.is_active })
    queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  return (
    <Section title="Usuarios">
      <div className="space-y-4">
        <button
          onClick={handleInvite}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Generar invitación
        </button>

        {invite && (
          <div className="bg-slate-900 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-400">Link de invitación (válido 7 días)</p>
            <div className="flex items-center gap-2 bg-slate-800 rounded px-3 py-2">
              <code className="flex-1 text-xs text-indigo-300 break-all">
                {window.location.origin}{invite.invite_url}
              </code>
              <CopyButton text={`${window.location.origin}${invite.invite_url}`} />
            </div>
            <p className="text-xs text-slate-500">Código: <span className="font-mono">{invite.code}</span></p>
          </div>
        )}

        {apiToken && (
          <div className="bg-slate-900 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-400">Token API sin expiración (guárdalo ahora)</p>
            <div className="flex items-center gap-2 bg-slate-800 rounded px-3 py-2">
              <code className="flex-1 text-xs text-amber-300 break-all">{apiToken.token}</code>
              <CopyButton text={apiToken.token} />
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-700/50">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">
                {u.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${u.is_active ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{u.username}</p>
                <p className="text-xs text-slate-500 capitalize">{u.role} · {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: es })}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleApiToken(u.id)}
                  disabled={generatingToken === u.id}
                  className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
                >
                  Token API
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    u.is_active
                      ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  }`}
                >
                  {u.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: summary } = useSummary()
  const { isAdmin } = useAuth()

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100">Configuración</h1>
      <MyAccountSection />
      <FundsSection />
      <ProjectionSection summary={summary} />
      <CategoriesSection />
      <AlertsSection />
      {isAdmin && <UsersSection />}
    </div>
  )
}
