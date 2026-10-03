import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { nomAffiche } from '../../lib/roles'
import type { Membre } from '../../types'

export async function publierAnnonce(auteur: Membre, titre: string, contenu: string): Promise<void> {
  await addDoc(collection(db, 'annonces'), {
    titre: titre.trim(),
    contenu: contenu.trim(),
    auteurUid: auteur.uid,
    auteurNom: nomAffiche(auteur),
    createdAt: serverTimestamp(),
  })
}

export async function supprimerAnnonce(id: string): Promise<void> {
  await deleteDoc(doc(db, 'annonces', id))
}
