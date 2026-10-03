import type { ModeleVehicule } from '../../types'

const CLASSES: Record<string, string> = {
  SPORT: 'Sportive',
  SPORT_CLASSIC: 'Sportive classique',
  SUPER: 'Super',
  MUSCLE: 'Muscle',
  COUPE: 'Coupé',
  SEDAN: 'Berline',
  COMPACT: 'Compacte',
  SUV: 'SUV',
  OFF_ROAD: 'Tout-terrain',
  MOTORCYCLE: 'Moto',
  VAN: 'Van',
  CYCLE: 'Vélo',
  BOAT: 'Bateau',
  HELICOPTER: 'Hélicoptère',
  PLANE: 'Avion',
  COMMERCIAL: 'Commercial',
  INDUSTRIAL: 'Industriel',
  UTILITY: 'Utilitaire',
  SERVICE: 'Service',
  EMERGENCY: 'Urgence',
  MILITARY: 'Militaire',
  OPEN_WHEEL: 'Monoplace',
}

// Catégorie du jeu, en français
export const libelleClasse = (classe: string) => CLASSES[classe] ?? classe

// Minuscules, sans accents ni ponctuation : « BF 400 », « bf400 » et « BF-400 » se valent
export const normaliser = (texte: string) =>
  texte
    .normalize('NFD')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]/g, '')

// À nom égal, le modèle de base a le nom de spawn le plus court (« sultan » avant « sultan3 »)
const leplusCourt = (modeles: ModeleVehicule[]) =>
  [...modeles].sort((a, b) => a.spawn.length - b.spawn.length || a.spawn.localeCompare(b.spawn))[0]

// Modèle du catalogue correspondant à un véhicule : par son nom de spawn s'il en a un, sinon en rapprochant
// le texte saisi — nom identique, ou seul modèle dont le nom contient ce texte (« Hellfire » → Gauntlet Hellfire).
// Le rapprochement ne sert qu'à l'affichage : rien n'est écrit en base.
export function trouverModele(
  vehicule: { spawn?: string | null; modele: string },
  catalogue: ModeleVehicule[],
): ModeleVehicule | undefined {
  if (vehicule.spawn) return catalogue.find((m) => m.spawn === vehicule.spawn)

  const texte = normaliser(vehicule.modele)
  if (texte.length < 3) return undefined

  const identiques = catalogue.filter((m) => normaliser(m.nom) === texte || m.spawn === texte)
  if (identiques.length > 0) return leplusCourt(identiques)

  const contenant = catalogue.filter((m) => normaliser(m.nom).includes(texte))
  // Plusieurs modèles différents contiennent le texte : trop ambigu pour choisir
  return new Set(contenant.map((m) => m.nom)).size === 1 ? leplusCourt(contenant) : undefined
}
