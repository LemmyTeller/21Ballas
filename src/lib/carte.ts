import carte from '../data/carte.json'
import type { EtapePlan, PointCarte, TypePoint } from '../types'

// Dimensions de la carte et de son découpage en tuiles, écrites par `npm run carte`
export const CARTE = carte

// Liste fixe. Les ids doivent rester alignés sur pointValide() dans firestore.rules.
export const TYPES_POINT: { id: TypePoint; nom: string; pluriel: string; couleur: string }[] = [
  { id: 'commerce', nom: 'Commerce', pluriel: 'Commerces', couleur: '#9333ea' },
  { id: 'plan', nom: 'Plan de récolte', pluriel: 'Plans de récolte', couleur: '#16a34a' },
  { id: 'interet', nom: 'Point d’intérêt', pluriel: 'Points d’intérêt', couleur: '#2563eb' },
  { id: 'danger', nom: 'Danger', pluriel: 'Dangers', couleur: '#dc2626' },
]

export const typePoint = (id: TypePoint) => TYPES_POINT.find((t) => t.id === id) ?? TYPES_POINT[0]

// ---- Plans de récolte ----

export const ETAPES: EtapePlan[] = ['germination', 'croissance', 'floraison']

export const ETAPE_LABELS: Record<EtapePlan, string> = {
  germination: 'Germination',
  croissance: 'Croissance',
  floraison: 'Floraison',
}

// Effet d'un plan sur le Stock : chaque plant consomme une graine à la plantation et rend dix têtes à la récolte.
// Clés du catalogue des items.
export const REFERENCE_GRAINE = '610'
export const REFERENCE_TETE = '167'
export const TETES_PAR_PLANT = 10

// Chaque étape dure 30 minutes. Doit rester aligné sur la règle d'arrosage dans firestore.rules.
export const DUREE_ETAPE_MS = 30 * 60_000

// `pousse` : l'étape est en cours ; `arroser` : elle est finie, il faut arroser pour lancer la suivante ;
// `pret` : la floraison est finie, le plan se récolte.
export type EtatPlan = 'pousse' | 'arroser' | 'pret'

export const COULEURS_PLAN: Record<EtatPlan, string> = { pousse: '#16a34a', arroser: '#0ea5e9', pret: '#eab308' }

// Où en est un plan. Rien n'est planifié : tout se déduit du début de l'étape en cours.
export function etatPlan(
  point: Pick<PointCarte, 'etape' | 'etapeDebut'>,
  maintenant: number,
): { etat: EtatPlan; restant: number } {
  // `etapeDebut` est null le temps que le serveur confirme l'heure : l'étape vient de commencer
  const fin = (point.etapeDebut?.toMillis() ?? maintenant) + DUREE_ETAPE_MS
  // Jamais plus que la durée d'une étape : l'heure affichée n'avance que chaque minute, et l'horloge du poste
  // peut retarder sur celle du serveur
  if (maintenant < fin) return { etat: 'pousse', restant: Math.min(fin - maintenant, DUREE_ETAPE_MS) }
  return { etat: point.etape === 'floraison' ? 'pret' : 'arroser', restant: 0 }
}

// Étape lancée par un arrosage ; null après la floraison (il ne reste qu'à récolter)
export function etapeSuivante(etape: EtapePlan | null): EtapePlan | null {
  const index = etape ? ETAPES.indexOf(etape) : -1
  return index >= 0 && index < ETAPES.length - 1 ? ETAPES[index + 1] : null
}
