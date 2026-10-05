// Réglages de confort propres à chaque joueur, gardés dans son navigateur (rien en base) :
// ils sont donc à refaire sur un autre appareil.

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    // Stockage indisponible (navigation privée stricte…) : on retombe sur les valeurs par défaut
    return null
  }
}

function ecrire(cle: string, valeur: string | null) {
  try {
    if (valeur === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, valeur)
  } catch {
    // Le réglage vaut au moins pour la page en cours
  }
}

// ---- Taille d'affichage ----

export const TAILLES = [100, 90, 80] as const
export type Taille = (typeof TAILLES)[number]
const TAILLE_DEFAUT: Taille = 90
const CLE_TAILLE = 'ballas.taille'

export function lireTaille(): Taille {
  const valeur = Number(lire(CLE_TAILLE))
  return TAILLES.find((t) => t === valeur) ?? TAILLE_DEFAUT
}

// Toute l'appli est dimensionnée en rem : changer la taille de base de la page réduit tout d'un bloc,
// comme le zoom du navigateur.
export function appliquerTaille(taille: Taille) {
  document.documentElement.style.fontSize = `${taille}%`
}

export function enregistrerTaille(taille: Taille) {
  ecrire(CLE_TAILLE, String(taille))
  appliquerTaille(taille)
}

// ---- Menu rétracté ----

const CLE_MENU = 'ballas.menu'

export const lireMenuReduit = () => lire(CLE_MENU) === 'reduit'

export function enregistrerMenuReduit(reduit: boolean) {
  ecrire(CLE_MENU, reduit ? 'reduit' : null)
}

// ---- Disposition de l'accueil ----

// Les encarts de l'accueil, dans l'ordre des emplacements par défaut : rangée du haut (large, large, étroit),
// puis rangée du bas (large, deux étroits l'un sur l'autre, étroit).
export const ENCARTS = ['taches', 'annonces', 'presents', 'saisie', 'recidives', 'blanchiment', 'contrats'] as const
export type Encart = (typeof ENCARTS)[number]
const CLE_ACCUEIL = 'ballas.accueil'

// `disposition[i]` : l'encart affiché dans l'emplacement i
export function lireDisposition(): Encart[] {
  let liste: unknown
  try {
    liste = JSON.parse(lire(CLE_ACCUEIL) ?? 'null')
  } catch {
    liste = null
  }
  if (!Array.isArray(liste)) return [...ENCARTS]
  // Chaque encart une fois et une seule : ceux qui manquent (encart ajouté depuis) reprennent une place libre
  const connus = liste.filter((e, i): e is Encart => ENCARTS.includes(e) && liste.indexOf(e) === i)
  return [...connus, ...ENCARTS.filter((e) => !connus.includes(e))]
}

// `null` : retour à la disposition d'origine
export function enregistrerDisposition(disposition: Encart[] | null) {
  ecrire(CLE_ACCUEIL, disposition && JSON.stringify(disposition))
}

// ---- Largeur des encarts de l'accueil ----

// `auto` : l'encart se partage la largeur laissée libre par les autres de sa rangée
export const LARGEURS = {
  auto: { nom: 'Auto', colonne: 'minmax(0,1fr)' },
  etroit: { nom: 'Étroit', colonne: 'minmax(0,19rem)' },
  moyen: { nom: 'Moyen', colonne: 'minmax(0,26rem)' },
  large: { nom: 'Large', colonne: 'minmax(0,34rem)' },
} as const
export type Largeur = keyof typeof LARGEURS

// La largeur suit l'encart quand il change de place
const LARGEURS_DEFAUT: Record<Encart, Largeur> = {
  taches: 'auto',
  annonces: 'auto',
  presents: 'etroit',
  saisie: 'auto',
  recidives: 'etroit',
  blanchiment: 'etroit',
  contrats: 'etroit',
}
const CLE_LARGEURS = 'ballas.largeurs'

export function lireLargeurs(): Record<Encart, Largeur> {
  let choix: unknown
  try {
    choix = JSON.parse(lire(CLE_LARGEURS) ?? 'null')
  } catch {
    choix = null
  }
  const largeurs = { ...LARGEURS_DEFAUT }
  if (choix && typeof choix === 'object') {
    for (const encart of ENCARTS) {
      const valeur = (choix as Record<string, unknown>)[encart]
      if (typeof valeur === 'string' && valeur in LARGEURS) largeurs[encart] = valeur as Largeur
    }
  }
  return largeurs
}

// `null` : retour aux largeurs d'origine
export function enregistrerLargeurs(largeurs: Record<Encart, Largeur> | null) {
  ecrire(CLE_LARGEURS, largeurs && JSON.stringify(largeurs))
}
