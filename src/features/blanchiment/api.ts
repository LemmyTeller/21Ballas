import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Article, Blanchiment, CommerceVille, GenreCommerce, OperationBlanchiment } from '../../types'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'
import { varierStock } from '../stock/mouvements'

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

// ---- Compte d'un commerce : il blanchit en continu, on y ajoute du sale et on en retire du propre ----

type TypeOperation = OperationBlanchiment['type']

// Enregistre le nouvel état du commerce et sa ligne de journal, dans une écriture groupée.
// `etat` : sale et propre juste après l'opération ; l'heure du relevé est celle du serveur.
function operer(
  batch: WriteBatch,
  commerce: CommerceVille,
  type: TypeOperation,
  etat: { sale: number; propre: number },
  montant: number | null,
  lieuId: string | null,
  acteurUid: string,
) {
  const sale = Math.max(0, Math.round(etat.sale))
  const propre = Math.max(0, Math.round(etat.propre))
  batch.set(doc(db, 'comptesBlanchiment', commerce.id), { sale, propre, releveAt: serverTimestamp() })
  batch.set(doc(collection(db, 'operationsBlanchiment')), {
    type,
    commerceId: commerce.id,
    commerceNom: nomCommerce(commerce),
    montant,
    sale,
    propre,
    lieuId,
    parUid: acteurUid,
    createdAt: serverTimestamp(),
  })
}

// Ajoute du sale au commerce. `actuel` : son état estimé à l'instant. Avec un lieu, les billets de 1$ en sortent.
export async function ajouterSale(
  commerce: CommerceVille,
  actuel: { sale: number; propre: number },
  montant: number,
  lieuId: string | null,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  operer(batch, commerce, 'depot', { sale: actuel.sale + montant, propre: actuel.propre }, montant, lieuId, acteurUid)
  if (lieuId) varierStock(batch, articles, REFERENCE_ARGENT_SALE, lieuId, -Math.round(montant))
  await batch.commit()
}

// Retire du propre du commerce : seulement noté, l'argent propre n'est pas un item du Stock
export async function retirerPropre(
  commerce: CommerceVille,
  actuel: { sale: number; propre: number },
  montant: number,
  acteurUid: string,
): Promise<void> {
  const batch = writeBatch(db)
  operer(batch, commerce, 'retrait', { sale: actuel.sale, propre: actuel.propre - montant }, montant, null, acteurUid)
  await batch.commit()
}

// Recale le commerce sur les deux chiffres lus en jeu
export async function releverCompte(
  commerce: CommerceVille,
  releve: { sale: number; propre: number },
  acteurUid: string,
): Promise<void> {
  const batch = writeBatch(db)
  operer(batch, commerce, 'releve', releve, null, null, acteurUid)
  await batch.commit()
}

// ---- Anciens dépôts (un seul à la fois, récupéré à la fin) : plus aucun n'est lancé ----

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
