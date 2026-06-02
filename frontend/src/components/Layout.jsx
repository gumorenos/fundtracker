import { useEffect } from 'react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, ArrowUpDown, Settings, LogOut,
  Menu, Wallet, Lock, LockOpen,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getMe, setReadOnlyMode } from '../api/users'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transacciones', icon: ArrowUpDown },
  { to: '/settings', label: 'Configuración', icon: Settings },
]

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, logout, readOnly, setReadOnly } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const queryClient = useQueryClient()

  // Sync read_only_mode from server on mount
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().then((r) => r.data),
    staleTime: 60_000,
  })
  useEffect(() => {
    if (me) setReadOnly(me.read_only_mode)
  }, [me, setReadOnly])

  const handleToggleReadOnly = async () => {
    const newVal = !readOnly
    await setReadOnlyMode({ enabled: newVal })
    setReadOnly(newVal)
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-700">
        <Wallet className="w-6 h-6 text-indigo-400" />
        <span className="text-lg font-bold text-slate-100">FundTracker</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700 space-y-2">
        {/* Read-only toggle */}
        <button
          onClick={handleToggleReadOnly}
          title={readOnly ? 'Modo lectura activado — click para desactivar' : 'Activar modo lectura'}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            readOnly
              ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
          }`}
        >
          {readOnly ? <Lock className="w-4 h-4 shrink-0" /> : <LockOpen className="w-4 h-4 shrink-0" />}
          {readOnly ? 'Modo lectura' : 'Modo edición'}
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase">
            {user?.username?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.username}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-slate-900 border-r border-slate-700">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-900 border-r border-slate-700 transform transition-transform md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-slate-100">
            <Menu className="w-5 h-5" />
          </button>
          <Wallet className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-slate-100">FundTracker</span>
          {readOnly && <Lock className="w-4 h-4 text-amber-400 ml-auto" />}
        </header>

        {readOnly && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-400 text-xs text-center">
            Modo lectura activado — no puedes modificar datos
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
