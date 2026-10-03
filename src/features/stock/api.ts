import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PrixArticle } from '../../types'

export async function creerCategorie(nom: string): Promise<void> {
  await addDoc(collection(db, 'categoriesStock'), { nom: nom.trim(), createdAt: serverTimestamp() })
}

export async function renommerCategorie(id: string, nom: string): Promise<void> {
  await updateDoc(doc(db, 'categoriesStock', id), { nom: nom.trim() })
}

export async function supprimerCategorie(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categoriesStock', id))
}

// Premier classement d'un item : article (catégorie + quantité dans le lieu) et prix, ensemble
export async function creerArticle(
  itemId: string,
  categorieId: string,
  lieuId: string,
  quantite: number,
  prix: PrixArticle,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'articles', itemId), {
    categorieId,
    quantites: { [lieuId]: quantite },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'prixArticles', itemId), prix)
  await batch.commit()
}

export async function definirQuantite(itemId: string, lieuId: string, quantite: number): Promise<void> {
  await updateDoc(doc(db, 'articles', itemId), { [`quantites.${lieuId}`]: quantite, updatedAt: serverTimestamp() })
}

// Incrément atomique : deux gradés qui ajustent en même temps ne s'écrasent pas
export async function ajusterQuantite(itemId: string, lieuId: string, delta: number): Promise<void> {
  await updateDoc(doc(db, 'articles', itemId), {
    [`quantites.${lieuId}`]: increment(delta),
    updatedAt: serverTimestamp(),
  })
}

export async function retirerDuLieu(itemId: string, lieuId: string): Promise<void> {
  await updateDoc(doc(db, 'articles', itemId), { [`quantites.${lieuId}`]: deleteField(), updatedAt: serverTimestamp() })
}

export async function majArticle(itemId: string, categorieId: string, prix: PrixArticle): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'articles', itemId), { categorieId, updatedAt: serverTimestamp() })
  batch.set(doc(db, 'prixArticles', itemId), prix)
  await batch.commit()
}

export async function supprimerArticle(itemId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'articles', itemId))
  batch.delete(doc(db, 'prixArticles', itemId))
  await batch.commit()
}

// Réservé aux gradés par les règles
export async function lirePrix(itemId: string): Promise<PrixArticle | null> {
  const snap = await getDoc(doc(db, 'prixArticles', itemId))
  return (snap.data() as PrixArticle | undefined) ?? null
}
