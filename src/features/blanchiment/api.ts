import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Article, Blanchiment, CommerceVille, GenreCommerce } from '../../types'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'
import { quantiteDans } from '../stock/useArticles'

// Valeur de `proprietaireId` pour un commerce qui nous appartient
export const PROPRIETAIRE_NOUS = 'ballas'

export const GENRES: GenreCommerce[] = ['standard', 'securise', 'express']

export const GENRE_LABELS: Record<GenreCommerce, string> = {
  standard: 'Standard',
  securise: 'Sécurisé',
  express: 'Express',
}

// Les premières fiches n'avaient qu'une case « sécurisé »
export const genreCommerce = (commerce: Pick<CommerceVille, 'genre' | 'securise'>): GenreCommerce =>
  commerce.genre ?? (commerce.securise ? 'securise' : 'standard')

export type CommerceSaisie = Pick<
  CommerceVille,
  'zip' | 'nom' | 'description' | 'proprietaireId' | 'taux' | 'dureeMinutes' | 'montantMax' | 'note'
> & { genre: GenreCommerce }

function nettoyer(saisie: CommerceSaisie) {
  return {
    ...saisie,
    securise: saisie.genre === 'securise',
    zip: saisie.zip.trim(),
    nom: saisie.nom.trim(),
    description: saisie.description.trim(),
    note: saisie.note.trim(),
  }
}

export async function creerCommerce(saisie: CommerceSaisie): Promise<void> {
  await addDoc(collection(db, 'commerces'), {
    ...nettoyer(saisie),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function majCommerce(id: string, saisie: CommerceSaisie): Promise<void> {
  await updateDoc(doc(db, 'commerces', id), { ...nettoyer(saisie), updatedAt: serverTimestamp() })
}

export async function supprimerCommerce(id: string): Promise<void> {
  await deleteDoc(doc(db, 'commerces', id))
}

export const nomCommerce = (commerce: Pick<CommerceVille, 'nom' | 'zip'>) => commerce.nom || `Commerce ${commerce.zip}`

// Argent propre rendu par un dépôt : le taux est la part récupérée
export const propreAttendu = (montant: number, taux: number) => Math.round((montant * taux) / 100)

// « 2 h 30 », « 45 min », « 3 h »
export function formatDuree(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

export interface Lancement {
  montant: number
  taux: number
  dureeMinutes: number
  // Lieu d'où sortent les billets de 1$ ; null pour ne pas toucher au stock
  lieuId: string | null
}

// Lance un dépôt et sort les billets de 1$ du stock du lieu, dans la même écriture
export async function lancerBlanchiment(
  commerce: CommerceVille,
  lancement: Lancement,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const debut = Timestamp.now()
  const batch = writeBatch(db)

  batch.set(doc(collection(db, 'blanchiments')), {
    commerceId: commerce.id,
    commerceNom: nomCommerce(commerce),
    ...lancement,
    debut,
    fin: Timestamp.fromMillis(debut.toMillis() + lancement.dureeMinutes * 60_000),
    statut: 'en_cours',
    lanceParUid: acteurUid,
    createdAt: serverTimestamp(),
  })

  const billets = articles.find((a) => a.id === REFERENCE_ARGENT_SALE)
  if (lancement.lieuId && billets) {
    // Jamais sous zéro : on ne peut pas sortir plus que ce que le lieu contient
    const reste = Math.max(0, quantiteDans(billets, lancement.lieuId) - Math.round(lancement.montant))
    batch.update(doc(db, 'articles', REFERENCE_ARGENT_SALE), {
      [`quantites.${lancement.lieuId}`]: reste,
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

// L'argent propre est récupéré : le dépôt passe dans l'historique
export async function recupererBlanchiment(id: string, montantRecupere: number, acteurUid: string): Promise<void> {
  await updateDoc(doc(db, 'blanchiments', id), {
    statut: 'recupere',
    montantRecupere,
    recupereParUid: acteurUid,
    recupereAt: serverTimestamp(),
  })
}

// Lancement fait par erreur : le dépôt est supprimé et les billets retournent dans le stock du lieu d'origine
export async function annulerBlanchiment(blanchiment: Blanchiment, articles: Article[]): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'blanchiments', blanchiment.id))
  if (blanchiment.lieuId && articles.some((a) => a.id === REFERENCE_ARGENT_SALE)) {
    batch.update(doc(db, 'articles', REFERENCE_ARGENT_SALE), {
      [`quantites.${blanchiment.lieuId}`]: increment(Math.round(blanchiment.montant)),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
