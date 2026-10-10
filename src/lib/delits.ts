import type { Amende } from '../types'

export type CategorieDelit = 'mineur' | 'moyen' | 'majeur'

export interface Delit {
  id: string
  nom: string
  // Libellé d'en-tête de colonne, dans la grille
  court: string
  categorie: CategorieDelit
}

// `delai` : durée de la récidive, en clair (voir DUREE_RECIDIVE_MS)
export const CATEGORIES_DELIT: { id: CategorieDelit; nom: string; delai: string }[] = [
  { id: 'mineur', nom: 'Délits mineurs', delai: 'pas de récidive' },
  { id: 'moyen', nom: 'Délits moyens', delai: 'récidive 24 h' },
  { id: 'majeur', nom: 'Délits majeurs', delai: 'récidive 7 jours' },
]

// Liste fixe. Les ids doivent rester alignés sur amendeValide() dans firestore.rules.
export const DELITS: Delit[] = [
  { id: 'dab', nom: 'Braquage de DAB', court: 'Braquage DAB', categorie: 'mineur' },
  { id: 'vol_voiture', nom: 'Vol de voiture', court: 'Vol de voiture', categorie: 'mineur' },
  { id: 'superette', nom: 'Braquage de supérette', court: 'Braquage Supp', categorie: 'moyen' },
  { id: 'pharmacie', nom: 'Braquage de pharmacie', court: 'Braquage Pharma', categorie: 'moyen' },
  { id: 'tatoueur', nom: 'Braquage de tatoueur', court: 'Braquage Tatoueur', categorie: 'moyen' },
  { id: 'coiffeur', nom: 'Braquage de coiffeur', court: 'Braquage Coiffeur', categorie: 'moyen' },
  { id: 'vetements', nom: 'Braquage de magasin de vêtements', court: 'Braquage Vêtements', categorie: 'moyen' },
  { id: 'fuite', nom: 'Délit de fuite', court: 'Délit de fuite', categorie: 'moyen' },
  { id: 'drogue', nom: 'Flag de drogue', court: 'Flag de dope', categorie: 'moyen' },
  { id: 'effraction', nom: 'Vol avec effraction', court: 'Vol avec effraction', categorie: 'moyen' },
  { id: 'agression', nom: 'Agression à main armée', court: 'Agression à main armée', categorie: 'majeur' },
  { id: 'ud_g6', nom: 'Braquage UD / G6', court: 'Braquage UD / G6', categorie: 'majeur' },
  { id: 'enlevement', nom: 'Enlèvement / Séquestration', court: 'Enlèvement Séquestration', categorie: 'majeur' },
  { id: 'otages', nom: 'Prise d’otages', court: 'Prise d’otages', categorie: 'majeur' },
  { id: 'banque', nom: 'Braquage de banque', court: 'Banque', categorie: 'majeur' },
  { id: 'bijouterie', nom: 'Braquage de bijouterie', court: 'Bijouterie', categorie: 'majeur' },
]

export const nomDelit = (id: string) => DELITS.find((d) => d.id === id)?.nom ?? id

export const categorieDelit = (id: string) => DELITS.find((d) => d.id === id)?.categorie

const HEURE_MS = 3_600_000
// Après une amende, le joueur est en récidive sur ce délit pendant un délai qui dépend de sa gravité :
// aucun pour un délit mineur, 24 h pour un délit moyen, 7 jours pour un délit majeur.
export const DUREE_RECIDIVE_MS: Record<CategorieDelit, number> = {
  mineur: 0,
  moyen: 24 * HEURE_MS,
  majeur: 7 * 24 * HEURE_MS,
}

export const dureeRecidive = (delit: string) => {
  const categorie = categorieDelit(delit)
  return categorie ? DUREE_RECIDIVE_MS[categorie] : 0
}

export const finRecidive = (amende: Amende) => amende.date.toMillis() + dureeRecidive(amende.delit)

export const cleRecidive = (membreUid: string, delit: string) => `${membreUid}|${delit}`

// Récidives encore ouvertes : pour chaque joueur et chaque délit, la dernière amende dont le délai court encore.
// Rien n'est stocké : tout se déduit de la date des amendes.
export function recidivesEnCours(amendes: Amende[], maintenant: number): Map<string, Amende> {
  const enCours = new Map<string, Amende>()
  for (const amende of amendes) {
    const debut = amende.date.toMillis()
    if (debut > maintenant || finRecidive(amende) <= maintenant) continue
    const cle = cleRecidive(amende.membreUid, amende.delit)
    const autre = enCours.get(cle)
    if (!autre || autre.date.toMillis() < debut) enCours.set(cle, amende)
  }
  return enCours
}

// Amende prise alors que le joueur était déjà en récidive sur ce délit
export function estRecidive(amende: Amende, amendes: Amende[]): boolean {
  const date = amende.date.toMillis()
  return amendes.some(
    (a) =>
      a.id !== amende.id &&
      a.membreUid === amende.membreUid &&
      a.delit === amende.delit &&
      a.date.toMillis() < date &&
      a.date.toMillis() > date - dureeRecidive(amende.delit),
  )
}
