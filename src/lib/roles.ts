import type { Timestamp } from 'firebase/firestore'
import type { Membre, Role } from '../types'

export const ROLE_LABELS: Record<Role, string> = {
  pending: 'En attente',
  membre: 'Masque noir',
  officier: 'Masque violet',
  n2: 'N2',
  n1: 'N1',
  // Ancien grade, remplacé par le droit admin : ne subsiste que sur une fiche pas encore migrée
  admin: 'Admin',
  revoque: 'Révoqué',
}

// Doit rester aligné sur rank() dans firestore.rules
const RANGS: Record<Role, number> = { revoque: -1, pending: 0, membre: 1, officier: 2, n2: 3, n1: 4, admin: 5 }

// Grades RP attribuables à un compte validé, du plus haut au plus bas
export const ROLES_VALIDES: Role[] = ['n1', 'n2', 'officier', 'membre']

// Le membre connecté, pour un test de droits : son grade RP et, à part, son droit d'administration.
// Le droit admin est invisible des autres : on ne le connaît que pour soi-même.
type Sujet = Pick<Membre, 'role' | 'admin'>

// Admin : porte le droit privé (compte validé), ou fiche encore à l'ancien grade « Admin »
export function aLeDroitAdmin(sujet: Sujet | null | undefined): boolean {
  if (!sujet) return false
  return sujet.role === 'admin' || (sujet.admin === true && RANGS[sujet.role] >= RANGS.membre)
}

// Avec un simple grade : comparaison de rangs (pour les autres membres).
// Avec le membre connecté : un admin passe partout, quel que soit son grade affiché.
export function aAuMoins(sujet: Role | Sujet | null | undefined, minimum: Role): boolean {
  if (!sujet) return false
  if (typeof sujet === 'string') return RANGS[sujet] >= RANGS[minimum]
  return aLeDroitAdmin(sujet) || RANGS[sujet.role] >= RANGS[minimum]
}

export function estValide(role: Role | undefined): boolean {
  return aAuMoins(role, 'membre')
}

export function rang(role: Role): number {
  return RANGS[role]
}

// L'admin gère tout le monde ; N1 et N2 uniquement les rangs strictement inférieurs au leur.
// Personne ne gère sa propre fiche par ce biais. Doit rester aligné sur firestore.rules.
// Une cible qui est admin sans que cela se voie sera refusée par la base à un N1 ou un N2.
export function peutGerer(acteur: Sujet & Pick<Membre, 'uid'>, cible: Pick<Membre, 'uid' | 'role'>): boolean {
  if (acteur.uid === cible.uid) return false
  if (aLeDroitAdmin(acteur)) return true
  return aAuMoins(acteur.role, 'n2') && RANGS[cible.role] < RANGS[acteur.role]
}

export function rolesAttribuables(acteur: Sujet): Role[] {
  return aLeDroitAdmin(acteur) ? ROLES_VALIDES : ROLES_VALIDES.filter((r) => RANGS[r] < RANGS[acteur.role])
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
