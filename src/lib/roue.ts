// Cases de la roue de la chance, dans l'ordre où elles sont dessinées (sens des aiguilles d'une montre, depuis le haut).
// `effet` : ce que la case fait de la quantité de pochons due. Doit rester aligné sur tirageValide() dans firestore.rules.
export interface CaseRoue {
  libelle: string
  effet: { type: 'fois' | 'divise' | 'plus'; valeur: number }
}

export const CASES_ROUE: CaseRoue[] = [
  { libelle: 'X2', effet: { type: 'fois', valeur: 2 } },
  { libelle: '/2', effet: { type: 'divise', valeur: 2 } },
  { libelle: 'X1.5', effet: { type: 'fois', valeur: 1.5 } },
  { libelle: 'X1.25', effet: { type: 'fois', valeur: 1.25 } },
  { libelle: '/1.5', effet: { type: 'divise', valeur: 1.5 } },
  { libelle: '+10', effet: { type: 'plus', valeur: 10 } },
  { libelle: '+10', effet: { type: 'plus', valeur: 10 } },
  { libelle: '+10', effet: { type: 'plus', valeur: 10 } },
  { libelle: '-10', effet: { type: 'plus', valeur: -10 } },
  { libelle: '+5', effet: { type: 'plus', valeur: 5 } },

  { libelle: '+20', effet: { type: 'plus', valeur: 20 } },
  { libelle: '+25', effet: { type: 'plus', valeur: 25 } },
  { libelle: '-5', effet: { type: 'plus', valeur: -5 } },
  { libelle: '+5', effet: { type: 'plus', valeur: 5 } },
  { libelle: '+1', effet: { type: 'plus', valeur: 1 } },
  { libelle: '-5', effet: { type: 'plus', valeur: -5 } },
]

// Pochons après passage sur une case : arrondi au pochon le plus proche, jamais sous zéro
export function appliquerCase(quantite: number, caseRoue: CaseRoue): number {
  const { type, valeur } = caseRoue.effet
  const brut = type === 'fois' ? quantite * valeur : type === 'divise' ? quantite / valeur : quantite + valeur
  return Math.max(0, Math.round(brut))
}

// Case tirée au hasard, chacune avec la même chance (générateur du navigateur prévu pour la cryptographie)
export function tirerCase(): number {
  const tirage = new Uint32Array(1)
  crypto.getRandomValues(tirage)
  return tirage[0] % CASES_ROUE.length
}

// Nombre au hasard entre -0,5 et 0,5 : pour que la roue ne s'arrête pas toujours pile au centre de la case
export function decalageAleatoire(): number {
  return Math.random() - 0.5
}

// Une case bonne pour le groupe qui reçoit les pochons (le résultat augmente)
export const estGain = (caseRoue: CaseRoue) =>
  caseRoue.effet.type === 'divise' ? false : caseRoue.effet.type === 'fois' ? caseRoue.effet.valeur > 1 : caseRoue.effet.valeur > 0
