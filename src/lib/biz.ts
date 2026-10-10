import type { Transformation } from '../types'

// La chaîne du business : caisses → graines → plants → têtes → pochons. Règles du jeu, à garder alignées sur
// firestore.rules (durée et rendement d'un lot) et sur src/lib/carte.ts (graine par plant, têtes par plant).
export const GRAINES_PAR_CAISSE = 10
export const TETES_PAR_POCHON = 2
// Environ 10 minutes pour 200 têtes à l'établi
export const SECONDES_PAR_TETE = 3
// Têtes qu'un lot peut transformer d'un coup
export const TETES_MAX = 500
// Clé du catalogue : « Pochon de cannabis »
export const REFERENCE_POCHON = '169'

export const pochonsPour = (tetes: number) => Math.floor(tetes / TETES_PAR_POCHON)

// Fin d'un lot. `debut` est null le temps que le serveur confirme l'heure : le lot vient de partir.
export function finLot(lot: Pick<Transformation, 'debut' | 'dureeSecondes'>, maintenant: number): number {
  return (lot.debut?.toMillis() ?? maintenant) + lot.dureeSecondes * 1000
}
