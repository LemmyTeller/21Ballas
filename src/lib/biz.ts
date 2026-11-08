import type { Transformation, ZoneTransformation } from '../types'

// La chaîne du business : graines → plants → têtes → pochons. Règles du jeu, à garder alignées sur firestore.rules
// (zone de transformation) et sur src/lib/carte.ts (graine par plant, têtes par plant).
export const TETES_PAR_POCHON = 2
// Un pochon (2 têtes) sort toutes les 9 secondes, soit 4,5 s par tête
export const SECONDES_PAR_POCHON = 9
export const SECONDES_PAR_TETE = SECONDES_PAR_POCHON / TETES_PAR_POCHON
// Têtes que la zone de transformation peut contenir en même temps
export const TETES_MAX = 500
// Clé du catalogue : « Pochon de cannabis »
export const REFERENCE_POCHON = '169'

export const pochonsPour = (tetes: number) => Math.floor(tetes / TETES_PAR_POCHON)

export interface EtatZone {
  // Têtes encore à transformer, pochons prêts (arrondis à l'unité inférieure), place libre pour de nouvelles têtes
  tetes: number
  pochons: number
  libre: number
  // Secondes avant que toutes les têtes soient transformées
  secondesRestantes: number
}

// Où en est la zone de transformation. Elle transforme en continu, comme un commerce de blanchiment : un pochon
// (2 têtes) toutes les 9 secondes. Rien n'est planifié : tout se déduit du dernier état enregistré et du temps écoulé depuis.
export function estimerZone(
  zone: Pick<ZoneTransformation, 'tetes' | 'pochons' | 'releveAt'> | undefined,
  maintenant: number,
): EtatZone {
  const tetes = zone?.tetes ?? 0
  const pochons = zone?.pochons ?? 0
  // `releveAt` est null le temps que le serveur confirme l'heure : l'état vient d'être enregistré
  const ecoule = Math.max(0, (maintenant - (zone?.releveAt?.toMillis() ?? maintenant)) / 1000)
  const transformees = Math.min(tetes, ecoule / SECONDES_PAR_TETE)
  const restantes = tetes - transformees
  return {
    tetes: Math.ceil(restantes),
    pochons: Math.floor(pochons + transformees / TETES_PAR_POCHON),
    libre: Math.max(0, TETES_MAX - Math.ceil(restantes)),
    secondesRestantes: restantes * SECONDES_PAR_TETE,
  }
}

// Valeurs exactes (non arrondies) de la zone à un instant, pour enregistrer un nouvel état sans rien perdre
export function zoneExacte(
  zone: Pick<ZoneTransformation, 'tetes' | 'pochons' | 'releveAt'> | undefined,
  maintenant: number,
): { tetes: number; pochons: number } {
  const tetes = zone?.tetes ?? 0
  const ecoule = Math.max(0, (maintenant - (zone?.releveAt?.toMillis() ?? maintenant)) / 1000)
  const transformees = Math.min(tetes, ecoule / SECONDES_PAR_TETE)
  return { tetes: tetes - transformees, pochons: (zone?.pochons ?? 0) + transformees / TETES_PAR_POCHON }
}

// Ancien lot à l'établi (un seul, récupéré à la fin) : fin du lot
export function finLot(lot: Pick<Transformation, 'debut' | 'dureeSecondes'>, maintenant: number): number {
  return (lot.debut?.toMillis() ?? maintenant) + lot.dureeSecondes * 1000
}
