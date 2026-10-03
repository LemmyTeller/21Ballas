import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { aAuMoins } from '../lib/roles'
import type { Role } from '../types'
import { useAuth } from './AuthContext'

// Masque seulement l'écran : la vraie protection est dans firestore.rules
export function RequireRole({ minimum, children }: { minimum: Role; children: ReactNode }) {
  const { membre } = useAuth()
  if (!aAuMoins(membre?.role, minimum)) return <Navigate to="/" replace />
  return children
}
