import type { RaisonRevocation, RaisonSortie, RaisonSuppression } from '../types'

export const RAISON_LABELS: Record<RaisonSortie, string> = {
  cavale: 'Cavale',
  absence: 'Absence longue',
  refus: 'Demande refusée',
  mort: 'Mort',
  quitte_ile: 'A quitté l’île',
}

// Ce que chaque raison déclenche, tel qu'expliqué au gradé au moment du choix
export const RAISON_EFFETS: Record<Exclude<RaisonSortie, 'refus'>, string> = {
  cavale: 'Accès coupé. Le joueur peut être réintégré ; sinon il finira supprimé (mort ou départ de l’île).',
  absence: 'Accès coupé en attendant son retour, sa mort ou son départ de l’île.',
  mort: 'Le joueur est supprimé définitivement.',
  quitte_ile: 'Le joueur est supprimé définitivement.',
}

export const RAISONS_REVOCATION: Exclude<RaisonRevocation, 'refus'>[] = ['cavale', 'absence']
export const RAISONS_SUPPRESSION: RaisonSuppression[] = ['mort', 'quitte_ile']

export function estSuppression(raison: RaisonSortie): raison is RaisonSuppression {
  return raison === 'mort' || raison === 'quitte_ile'
}

// Message affiché au joueur révoqué qui tente de se connecter
export function messageRevocation(raison: RaisonRevocation | undefined): string {
  switch (raison) {
    case 'cavale':
      return 'Yo man, tu pars en cavale et tu veux revenir la queue entre les jambes au quartier… Je crois pas, non !'
    case 'absence':
      return 'Ton accès est suspendu pour absence longue. Si tu es de retour, vois ça avec un gradé en jeu.'
    default:
      return 'Ce compte n’a pas ou plus accès à l’intranet.'
  }
}
