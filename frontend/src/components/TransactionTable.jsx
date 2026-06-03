import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2, Pencil } from 'lucide-react'

const TYPE_CONFIG = {
  expense: { label: 'Gasto', cls: 'bg-rose-500/15 text-rose-300' },
  currency_exchange: { label: 'Cambio', cls: 'bg-blue-500/15 text-blue-300' },
  usd_expense: { label: 'Gasto USD', cls: 'bg-amber-500/15 text-amber-300' },
}

const fmtDate = (d) => format(parseISO(d), 'dd/MM/yyyy', { locale: es })
const fmtUSD = (v) => (v != null ? `$${parseFloat(v).toFixed(2)}` : '—')
const fmtPEN = (v) => (v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '—')
const fmtTC = (v) => (v != null ? parseFloat(v).toFixed(4) : '—')

export default function TransactionTable({
  transactions,
  onDelete,
  onEdit,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}) {
  const hasSelection = selectedIds && selectedIds.size > 0
  const allSelected = transactions?.length > 0 && transactions?.every((t) => selectedIds?.has(t.id))
  const showCheckboxes = !!onToggleSelect

  if (!transactions?.length) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No hay transacciones
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {showCheckboxes && (
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(transactions)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-600 cursor-pointer"
                />
              </th>
            )}
            {['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Fondo', 'USD', 'PEN', 'TC', ...(onEdit || onDelete ? [''] : [])].map((h) => (
              <th
                key={h}
                className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {transactions.map((tx) => {
            const typeCfg = TYPE_CONFIG[tx.type] ?? { label: tx.type, cls: 'bg-slate-700 text-slate-300' }
            const isSelected = selectedIds?.has(tx.id)
            return (
              <tr
                key={tx.id}
                className={`transition-colors ${isSelected ? 'bg-indigo-600/10' : 'hover:bg-slate-700/30'}`}
              >
                {showCheckboxes && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected ?? false}
                      onChange={() => onToggleSelect(tx.id)}
                      className="rounded border-slate-600 bg-slate-900 text-indigo-600 cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                  {fmtDate(tx.transaction_date)}
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeCfg.cls}`}>
                    {typeCfg.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-200 max-w-[160px] truncate">
                  {tx.description || <span className="text-slate-500 italic">—</span>}
                </td>
                <td className="px-3 py-3">
                  {tx.category ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tx.category.color }}
                    >
                      {tx.category.name}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                  {tx.fund?.name ?? <span className="text-slate-600 italic">Sin asignar</span>}
                </td>
                <td className="px-3 py-3 text-slate-200 font-medium tabular-nums whitespace-nowrap">
                  {fmtUSD(tx.amount_usd)}
                </td>
                <td className="px-3 py-3 text-slate-400 tabular-nums whitespace-nowrap">
                  {fmtPEN(tx.amount_pen)}
                </td>
                <td className="px-3 py-3 text-slate-500 tabular-nums">
                  {fmtTC(tx.exchange_rate)}
                </td>
                {(onEdit || onDelete) && (
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(tx)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(tx.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
