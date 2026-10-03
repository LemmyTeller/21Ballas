import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Tache } from '../../types'

// Une nouvelle tâche arrive en bas de la liste : `ordre` = celui de la dernière + 1
export async function creerTache(auteurUid: string, titre: string, ordre: number): Promise<void> {
  await addDoc(collection(db, 'taches'), {
    titre: titre.trim(),
    ordre,
    fait: false,
    auteurUid,
    createdAt: serverTimestamp(),
  })
}

export async function cocherTache(id: string, fait: boolean): Promise<void> {
  await updateDoc(doc(db, 'taches', id), { fait })
}

// Monter ou descendre d'un cran : les deux tâches voisines échangent leur ordre
export async function echangerTaches(a: Tache, b: Tache): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'taches', a.id), { ordre: b.ordre })
  batch.update(doc(db, 'taches', b.id), { ordre: a.ordre })
  await batch.commit()
}

export async function supprimerTache(id: string): Promise<void> {
  await deleteDoc(doc(db, 'taches', id))
}
