import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Plus, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
} from '../api/transactions'
import { getCategories } from '../api/categories'
import { useAuth } from '../hooks/useAuth'
import TransactionTable from '../components/TransactionTable'

const PAGE_SIZE = 20

function NewTransactionModal({ categories, onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      currency: 'USD',
      amount_usd: '',
      amount_pen: '',
      exchange_rate: '',
      category_id: '',
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const currency = watch('currency')

  const onSubmit = async (data) => {
    const payload = {
      category_id: parseInt(data.category_id),
      description: data.description || null,
      transaction_date: data.transaction_date
        ? new Date(data.transaction_date).toISOString()
        : null,
    }
    if (currency === 'USD') {
      payload.amount_usd = parseFloat(data.amount_usd)
    } else {
      const pen = parseFloat(data.amount_pen)
      const tc = parseFloat(data.exchange_rate)
      payload.amount_usd = parseFloat((pen / tc).toFixed(2))
      payload.amount_pen = pen
      payload.exchange_rate = tc
    }
    await createTransaction(payload)
    reset()
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100">Nueva transacción</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Currency toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Moneda del gasto</label>
            <div className="flex gap-2">
              {['USD', 'PEN'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('currency', c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currency === c
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {currency === 'USD' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto USD</label>
              <input
                {...register('amount_usd', {
                  required: 'Requerido',
                  min: { value: 0.01, message: 'Debe ser mayor a 0' },
                })}
                type="number"
                step="0.01"
                className="field"
                placeholder="0.00"
              />
              {errors.amount_usd && <p className="err">{errors.amount_usd.message}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Monto PEN</label>
                <input
                  {...register('amount_pen', {
                    required: 'Requerido',
                    min: { value: 0.01, message: 'Mayor a 0' },
                  })}
                  type="number"
                  step="0.01"
                  className="field"
                  placeholder="0.00"
                />
                {errors.amount_pen && <p className="err">{errors.amount_pen.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de cambio</label>
                <input
                  {...register('exchange_rate', {
                    required: 'Requerido',
                    min: { value: 0.01, message: 'Mayor a 0' },
                  })}
                  type="number"
                  step="0.0001"
                  className="field"
                  placeholder="3.8000"
                />
                {errors.exchange_rate && <p className="err">{errors.exchange_rate.message}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Categoría</label>
            <select
              {...register('category_id', { required: 'Requerido' })}
              className="field"
            >
              <option value="">Seleccionar…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_id && <p className="err">{errors.category_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción</label>
            <input
              {...register('description')}
              className="field"
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha</label>
            <input
              {...register('transaction_date')}
              type="date"
              className="field"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Transactions() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-all'],
    queryFn: () => getTransactions({ limit: 500 }).then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then((r) => r.data),
  })

  const filtered = useMemo(() => {
    let list = transactions
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.description?.toLowerCase().includes(q))
    }
    if (filterCat) list = list.filter((t) => t.category_id === parseInt(filterCat))
    if (dateFrom) list = list.filter((t) => t.transaction_date >= dateFrom)
    if (dateTo) list = list.filter((t) => t.transaction_date <= dateTo + 'T23:59:59')
    return list
  }, [transactions, search, filterCat, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    await deleteTransaction(id)
    queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
    queryClient.invalidateQueries({ queryKey: ['transactions-recent'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
  }

  const handleSuccess = () => {
    setShowModal(false)
    queryClient.invalidateQueries({ queryKey: ['transactions-all'] })
    queryClient.invalidateQueries({ queryKey: ['transactions-recent'] })
    queryClient.invalidateQueries({ queryKey: ['summary'] })
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Transacciones</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar descripción…"
              className="field pl-9"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => { setFilterCat(e.target.value); setPage(1) }}
            className="field"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="field"
            placeholder="Desde"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="field"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Cargando…</div>
        ) : (
          <TransactionTable
            transactions={paginated}
            onDelete={isAdmin ? handleDelete : undefined}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-sm text-slate-400">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewTransactionModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
