import type { Lieu, Membre, Vehicule } from '../../types'

// Couleur attitrée de chaque membre, reprise sur le nom de ses véhicules (comme dans l'ancien tableau)
const PALETTE = [
  'text-amber-400',
  'text-sky-400',
  'text-red-400',
  'text-emerald-400',
  'text-fuchsia-400',
  'text-orange-400',
  'text-cyan-300',
  'text-lime-400',
  'text-rose-300',
  'text-indigo-300',
  'text-yellow-200',
  'text-teal-300',
]

// Attribuée dans l'ordre d'arrivée dans le groupe : l'arrivée d'un nouveau ne change pas la couleur des anciens
export function couleursMembres(membres: Membre[]): Map<string, string> {
  const ordre = [...membres].sort(
    (a, b) => (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity) || a.uid.localeCompare(b.uid),
  )
  return new Map(ordre.map((m, i) => [m.uid, PALETTE[i % PALETTE.length]]))
}

export function occupation(lieu: Lieu, vehicules: Vehicule[]): number {
  return vehicules.filter((v) => v.lieuId === lieu.id).length
}

// Un garage plein reste proposé au véhicule qui s'y trouve déjà
export function lieuComplet(lieu: Lieu, vehicules: Vehicule[], vehiculeId?: string): boolean {
  return vehicules.filter((v) => v.lieuId === lieu.id && v.id !== vehiculeId).length >= lieu.capacite
}

const montant = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatMontant(valeur: number | undefined): string {
  return montant.format(valeur ?? 0)
}

// Seuil au-delà duquel un solde passe du vert clair au vert franc
export const SOLDE_CONFORTABLE = 300_000

export function classeSolde(valeur: number | undefined): string {
  if (!valeur) return 'bg-red-600 text-white'
  return valeur >= SOLDE_CONFORTABLE ? 'bg-green-600 text-white' : 'bg-green-300 text-green-950'
}
