import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      username: payload.sub,
      role: payload.role,
      read_only_mode: payload.read_only ?? false,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [readOnly, setReadOnly] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? (JSON.parse(stored).read_only_mode ?? false) : false
  })

  const login = useCallback((token) => {
    const userData = parseToken(token)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setReadOnly(userData?.read_only_mode ?? false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setReadOnly(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        readOnly,
        setReadOnly,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
