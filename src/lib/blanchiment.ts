import type { CommerceVille, CompteBlanchiment } from '../types'

// Un commerce plein se blanchit en 22 h : valeur proposée pour un nouveau commerce
export const DUREE_DEFAUT_MINUTES = 22 * 60

export interface Estimation {
  // Sale encore en attente et propre disponible, à l'instant demandé
  sale: number
  propre: number
  // false : taux, durée ou plafond manquant sur la fiche — les chiffres sont alors ceux du dernier relevé
  estimable: boolean
  // Place encore libre sous le plafond, et minutes avant que tout le sale soit blanchi ; null si non estimable
  libre: number | null
  minutesAvantVide: number | null
}

// Où en est un commerce à un instant donné. Le jeu blanchit en continu, à vitesse fixe : un commerce plein
// (`montantMax`) se vide en `dureeMinutes`, et chaque dollar de sale rend `taux` % de propre. Le plafond ne porte
// que sur le sale en attente : le propre s'accumule sans limite, qu'on le retire ou non.
// Rien n'est planifié : tout se déduit du dernier état enregistré (`compte`) et du temps écoulé depuis.
export function estimerCompte(
  compte: Pick<CompteBlanchiment, 'sale' | 'propre' | 'releveAt'> | undefined,
  commerce: Pick<CommerceVille, 'taux' | 'dureeMinutes' | 'montantMax'>,
  maintenant: number,
): Estimation {
  const sale = compte?.sale ?? 0
  const propre = compte?.propre ?? 0
  const { taux, dureeMinutes, montantMax } = commerce
  if (!taux || !dureeMinutes || !montantMax) {
    return { sale, propre, estimable: false, libre: null, minutesAvantVide: null }
  }

  const vitesse = montantMax / dureeMinutes
  // `releveAt` est null le temps que le serveur confirme l'heure : l'état vient d'être enregistré
  const ecoule = Math.max(0, (maintenant - (compte?.releveAt?.toMillis() ?? maintenant)) / 60_000)
  const blanchi = Math.min(sale, vitesse * ecoule)
  const saleRestant = sale - blanchi
  const propreDisponible = propre + (blanchi * taux) / 100

  return {
    sale: Math.round(saleRestant),
    propre: Math.round(propreDisponible),
    estimable: true,
    libre: Math.max(0, Math.round(montantMax - saleRestant)),
    minutesAvantVide: saleRestant / vitesse,
  }
}
