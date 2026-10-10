import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { aAuMoins, aLeDroitAdmin } from '../lib/roles'
import type { Role } from '../types'
import { useAuth } from './AuthContext'

// Masque seulement l'écran : la vraie protection est dans firestore.rules.
// `admin` : page réservée au droit d'administration, quel que soit le grade.
export function RequireRole({
  minimum,
  admin = false,
  children,
}: {
  minimum?: Role
  admin?: boolean
  children: ReactNode
}) {
  const { membre } = useAuth()
  const autorise = admin ? aLeDroitAdmin(membre) : minimum !== undefined && aAuMoins(membre, minimum)
  if (!autorise) return <Navigate to="/" replace />
  return children
}
