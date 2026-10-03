import type { Timestamp } from 'firebase/firestore'
import type { Membre, Role } from '../types'

export const ROLE_LABELS: Record<Role, string> = {
  pending: 'En attente',
  membre: 'Masque noir',
  officier: 'Masque violet',
  n2: 'N2',
  n1: 'N1',
  admin: 'Admin',
  revoque: 'Révoqué',
}

// Doit rester aligné sur rank() dans firestore.rules
const RANGS: Record<Role, number> = { revoque: -1, pending: 0, membre: 1, officier: 2, n2: 3, n1: 4, admin: 5 }

// Rôles attribuables à un compte validé, du plus haut au plus bas
export const ROLES_VALIDES: Role[] = ['admin', 'n1', 'n2', 'officier', 'membre']

export function aAuMoins(role: Role | undefined, minimum: Role): boolean {
  return role !== undefined && RANGS[role] >= RANGS[minimum]
}

export function estValide(role: Role | undefined): boolean {
  return aAuMoins(role, 'membre')
}

export function rang(role: Role): number {
  return RANGS[role]
}

// L'admin gère tout le monde ; N1 et N2 uniquement les rangs strictement inférieurs au leur.
// Personne ne modifie son propre rôle. Doit rester aligné sur firestore.rules.
export function peutGerer(acteur: Pick<Membre, 'uid' | 'role'>, cible: Pick<Membre, 'uid' | 'role'>): boolean {
  if (acteur.uid === cible.uid) return false
  if (acteur.role === 'admin') return true
  return aAuMoins(acteur.role, 'n2') && RANGS[cible.role] < RANGS[acteur.role]
}

export function rolesAttribuables(acteur: Role): Role[] {
  return acteur === 'admin' ? ROLES_VALIDES : ROLES_VALIDES.filter((r) => RANGS[r] < RANGS[acteur])
}

export function nomAffiche(membre: Pick<Membre, 'nomRP'> | undefined): string {
  return membre?.nomRP.trim() || 'Sans nom RP'
}

export function formatDate(ts: Timestamp | null | undefined, avecHeure = false): string {
  if (!ts) return '—'
  const date = ts.toDate()
  return avecHeure
    ? date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : date.toLocaleDateString('fr-FR')
}
