import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export async function creerCategorie(nom: string): Promise<void> {
  await addDoc(collection(db, 'categoriesStock'), { nom: nom.trim(), createdAt: serverTimestamp() })
}

export async function renommerCategorie(id: string, nom: string): Promise<void> {
  await updateDoc(doc(db, 'categoriesStock', id), { nom: nom.trim() })
}

export async function supprimerCategorie(id: string): Promise<void> {
  await deleteDoc(doc(db, 'categoriesStock', id))
}

// Premier classement d'un item : catégorie + quantité dans le lieu
export async function creerArticle(itemId: string, categorieId: string, lieuId: string, quantite: number): Promise<void> {
  await setDoc(doc(db, 'articles', itemId), {
    categorieId,
    quantites: { [lieuId]: quantite },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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

export async function majCategorie(itemId: string, categorieId: string): Promise<void> {
  await updateDoc(doc(db, 'articles', itemId), { categorieId, updatedAt: serverTimestamp() })
}

export async function supprimerArticle(itemId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'articles', itemId))
  // Ancien prix du Stock (les prix vivent désormais dans Tarifs) : nettoyé au passage s'il existe encore
  batch.delete(doc(db, 'prixArticles', itemId))
  await batch.commit()
}
