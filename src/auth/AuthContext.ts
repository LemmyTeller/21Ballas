import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'
import type { Membre } from '../types'

export interface AuthState {
  user: User | null
  membre: Membre | null
  loading: boolean
  error: string | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}

// À utiliser dans les pages protégées, où la fiche membre est garantie
export function useMembre(): Membre {
  const { membre } = useAuth()
  if (!membre) throw new Error('useMembre utilisé hors d’une page protégée')
  return membre
}
