export default function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconClass = 'text-indigo-400',
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      <div className="text-2xl font-semibold text-slate-100 tracking-tight">
        {value}
      </div>
      {subtitle && (
        <div className="text-sm text-slate-400">{subtitle}</div>
      )}
    </div>
  )
}
