import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Plus, X, ChevronLeft, ChevronRight, Search, Download, Trash2 } from 'lucide-react'
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
} from '../api/transactions'
import client from '../api/client'
import { getCategories } from '../api/categories'
import { getFunds } from '../api/funds'
import { exportExcel } from '../api/export'
import { useAuth } from '../hooks/useAuth'
import TransactionTable from '../components/TransactionTable'

const PAGE_SIZE = 20

const TX_TYPES = [
  { value: 'expense', label: 'Gasto en soles' },
  { value: 'currency_exchange', label: 'Cambio de moneda' },
  { value: 'usd_expense', label: 'Gasto en USD' },
]

const TYPE_LABELS = {
  expense: 'Gasto en soles',
  currency_exchange: 'Cambio de moneda',
  usd_expense: 'Gasto en USD',
}

// ── Transaction modal (create + edit) ─────────────────────────────────────────

function TransactionModal({ categories, funds, editingTx, onClose, onSuccess }) {
  const isEditing = !!editingTx
  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: editingTx
      ? {
          type: editingTx.type,
          amount_pen: editingTx.amount_pen ?? '',
          amount_usd: editingTx.amount_usd ?? '',
          exchange_rate: editingTx.exchange_rate ?? '',
          fund_id: editingTx.fund_id ?? '',
          category_id: editingTx.category_id ?? '',
          description: editingTx.description ?? '',
          notes: editingTx.notes ?? '',
          tags_raw: editingTx.tags?.join(', ') ?? '',
          transaction_date: editingTx.transaction_date
            ? format(new Date(editingTx.transaction_date), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
        }
      : {
          type: 'expense',
          amount_pen: '',
          amount_usd: '',
          exchange_rate: '',
          fund_id: funds[0]?.id ?? '',
          category_id: '',
          description: '',
          notes: '',
          tags_raw: '',
          transaction_date: format(new Date(), 'yyyy-MM-dd'),
        },
  })

  const txType = watch('type')
  const amountUsd = watch('amount_usd')
  const exchangeRate = watch('exchange_rate')

  useEffect(() => {
    if (txType !== 'currency_exchange') return
    const usd = parseFloat(amountUsd)
    const tc = parseFloat(exchangeRate)
    if (usd > 0 && tc > 0) setValue('amount_pen', (usd * tc).toFixed(2))
  }, [amountUsd, exchangeRate, txType, setValue])

  const onSubmit = async (data) => {
    const tags = data.tags_raw
      ? data.tags_raw.split(',').map((t) => t.trim()).filter(Boolean)
      : null
    const payload = {
      type: data.type,
      description: data.description || null,
      notes: data.notes || null,
      tags: tags?.length ? tags : null,
      transaction_date: data.transaction_date ? new Date(data.transaction_date).toISOString() : null,
    }
    if (data.type === 'expense') {
      payload.amount_pen = parseFloat(data.amount_pen)
      payload.category_id = parseInt(data.category_id)
      payload.fund_id = data.fund_id ? parseInt(data.fund_id) : null
    } else if (data.type === 'currency_exchange') {
      payload.amount_usd = parseFloat(data.amount_usd)
      payload.amount_pen = parseFloat(data.amount_pen)
      payload.exchange_rate = parseFloat(data.exchange_rate)
      payload.fund_id = parseInt(data.fund_id)
    } else if (data.type === 'usd_expense') {
      payload.amount_usd = parseFloat(data.amount_usd)
      payload.fund_id = parseInt(data.fund_id)
      payload.category_id = parseInt(data.category_id)
    }

    if (isEditing) {
      await client.put(`/transactions/${editingTx.id}`, payload)
    } else {
      await createTransaction(payload)
    }
    reset()
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="text-base font-semibold text-slate-100">
            {isEditing ? 'Editar transacción' : 'Nueva transacción'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TX_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setValue('type', t.value)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors leading-tight text-center ${
                    txType === t.value ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* expense */}
          {txType === 'expense' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto PEN</label>
                <input {...register('amount_pen', { required: 'Requerido', min: { value: 0.01, message: 'Mayor a 0' } })} type="number" step="0.01" className="field" placeholder="0.00" />
                {errors.amount_pen && <p className="err">{errors.amount_pen.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fondo <span className="text-slate-500 text-xs">(opcional)</span></label>
                <select {...register('fund_id')} className="field">
                  <option value="">Sin asignar</option>
                  {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría</label>
                <select {...register('category_id', { required: 'Requerido' })} className="field">
                  <option value="">Seleccionar…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.category_id && <p className="err">{errors.category_id.message}</p>}
              </div>
            </>
          )}

          {/* currency_exchange */}
          {txType === 'currency_exchange' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fondo</label>
                <div className="flex gap-2">
                  {funds.map((f) => (
                    <button key={f.id} type="button" onClick={() => setValue('fund_id', f.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        parseInt(watch('fund_id')) === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto USD</label>
                  <input {...register('amount_usd', { required: 'Requerido', min: { value: 0.01, message: 'Mayor a 0' } })} type="number" step="0.01" className="field" placeholder="0.00" />
                  {errors.amount_usd && <p className="err">{errors.amount_usd.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de cambio</label>
                  <input {...register('exchange_rate', { required: 'Requerido', min: { value: 0.01, message: 'Mayor a 0' } })} type="number" step="0.0001" className="field" placeholder="3.8000" />
                  {errors.exchange_rate && <p className="err">{errors.exchange_rate.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Monto PEN recibido <span className="text-slate-500 text-xs">(auto)</span>
                </label>
                <input {...register('amount_pen', { required: 'Requerido', min: { value: 0.01, message: 'Mayor a 0' } })} type="number" step="0.01" className="field" placeholder="0.00" />
                {errors.amount_pen && <p className="err">{errors.amount_pen.message}</p>}
              </div>
            </>
          )}

          {/* usd_expense */}
          {txType === 'usd_expense' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fondo</label>
                <div className="flex gap-2">
                  {funds.map((f) => (
                    <button key={f.id} type="button" onClick={() => setValue('fund_id', f.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        parseInt(watch('fund_id')) === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto USD</label>
                <input {...register('amount_usd', { required: 'Requerido', min: { value: 0.01, message: 'Mayor a 0' } })} type="number" step="0.01" className="field" placeholder="0.00" />
                {errors.amount_usd && <p className="err">{errors.amount_usd.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría</label>
                <select {...register('category_id', { required: 'Requerido' })} className="field">
                  <option value="">Seleccionar…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.category_id && <p className="err">{errors.category_id.message}</p>}
              </div>
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
            <input {...register('description')} className="field" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notas</label>
            <textarea {...register('notes')} rows={2} className="field resize-none" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Etiquetas <span className="text-slate-500 text-xs">(separadas por coma)</span>
            </label>
            <input {...register('tags_raw')} className="field" placeholder="urgente, recurrente" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha</label>
            <input {...register('transaction_date')} type="date" className="field" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:text-slate-100 text-sm font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Transactions() {
  const { isAdmin, readOnly } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterFund, setFilterFund] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-all'],
    queryFn: () => getTransactions({ limit: 500 }).then((r) => r.data),
    staleTime: 30_000,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data),
  })
  const { data: funds = [] } = useQuery({
    queryKey: ['funds'],
    queryFn: () => getFunds().then((r) => r.data),
  })

  const filtered = useMemo(() => {
    let list = transactions
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.description?.toLowerCase().includes(q))
    }
    if (filterCat) list = list.filter((t) => t.category_id === parseInt(filterCat))
    if (filterType) list = list.filter((t) => t.type === filterType)
    if (filterTag) list = list.filter((t) => t.tags?.includes(filterTag))
    if (filterFund === 'unassigned') list = list.filter((t) => !t.fund_id)
    else if (filterFund) list = list.filter((t) => t.fund_id === parseInt(filterFund))
    if (dateFrom) list = list.filter((t) => t.transaction_date >= dateFrom)
    if (dateTo) list = list.filter((t) => t.transaction_date <= dateTo + 'T23:59:59')
    return list
  }, [transactions, search, filterCat, filterType, filterTag, filterFund, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
    queryClient.invalidateQueries({ queryKey: ['transactions-recent'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    await deleteTransaction(id)
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    invalidate()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} transacción${selectedIds.size !== 1 ? 'es' : ''}?`)) return
    await client.delete('/transactions/bulk', { data: { ids: [...selectedIds] } })
    setSelectedIds(new Set())
    invalidate()
  }

  const handleEdit = (tx) => setEditingTx(tx)

  const handleSuccess = () => {
    setShowModal(false)
    setEditingTx(null)
    invalidate()
    setPage(1)
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handleToggleAll = (txList) => {
    const allSelected = txList.every((t) => selectedIds.has(t.id))
    if (allSelected) {
      setSelectedIds((prev) => {
        const s = new Set(prev)
        txList.forEach((t) => s.delete(t.id))
        return s
      })
    } else {
      setSelectedIds((prev) => {
        const s = new Set(prev)
        txList.forEach((t) => s.add(t.id))
        return s
      })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportExcel({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `fundtracker_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const resetFilter = (setter) => (e) => { setter(e.target.value); setPage(1) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-100">Transacciones</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar {selectedIds.size}
            </button>
          )}
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Excel'}
          </button>
          {!readOnly && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={resetFilter(setSearch)} placeholder="Descripción…" className="field pl-9" />
          </div>
          <select value={filterType} onChange={resetFilter(setFilterType)} className="field">
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filterFund} onChange={resetFilter(setFilterFund)} className="field">
            <option value="">Todos los fondos</option>
            <option value="unassigned">Sin asignar</option>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={filterCat} onChange={resetFilter(setFilterCat)} className="field">
            <option value="">Categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={filterTag} onChange={resetFilter(setFilterTag)} placeholder="Etiqueta…" className="field" />
          <input type="date" value={dateFrom} onChange={resetFilter(setDateFrom)} className="field" />
          <input type="date" value={dateTo} onChange={resetFilter(setDateTo)} className="field" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Cargando…</div>
        ) : (
          <TransactionTable
            transactions={paginated}
            onDelete={isAdmin && !readOnly ? handleDelete : undefined}
            onEdit={!readOnly ? handleEdit : undefined}
            selectedIds={isAdmin ? selectedIds : undefined}
            onToggleSelect={isAdmin ? handleToggleSelect : undefined}
            onToggleAll={isAdmin ? handleToggleAll : undefined}
          />
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-sm text-slate-400">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-300">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {(showModal || editingTx) && (
        <TransactionModal
          categories={categories}
          funds={funds}
          editingTx={editingTx}
          onClose={() => { setShowModal(false); setEditingTx(null) }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
