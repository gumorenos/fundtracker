import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Wallet, AlertCircle } from 'lucide-react'
import { registerWithInvite } from '../api/users'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('code') ?? ''

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { invite_code: inviteCode } })

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const onSubmit = async ({ username, password, invite_code }) => {
    try {
      const res = await registerWithInvite({ username, password, invite_code })
      login(res.data.access_token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Error al registrarse'
      setError('root', { message: detail })
    }
  }

  const password = watch('password')

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-100">FundTracker</h1>
            <p className="text-slate-400 text-sm mt-1">Crear cuenta</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Usuario</label>
              <input
                {...register('username', {
                  required: 'Requerido',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                })}
                className="field"
                placeholder="mi_usuario"
                autoComplete="username"
                autoFocus
              />
              {errors.username && <p className="err">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <input
                {...register('password', {
                  required: 'Requerido',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
                type="password"
                className="field"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {errors.password && <p className="err">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar contraseña</label>
              <input
                {...register('confirm_password', {
                  required: 'Requerido',
                  validate: (v) => v === password || 'Las contraseñas no coinciden',
                })}
                type="password"
                className="field"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {errors.confirm_password && <p className="err">{errors.confirm_password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Código de invitación</label>
              <input
                {...register('invite_code', { required: 'Requerido' })}
                className="field font-mono text-xs"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {errors.invite_code && <p className="err">{errors.invite_code.message}</p>}
            </div>

            {errors.root && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {isSubmitting ? 'Registrando…' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
