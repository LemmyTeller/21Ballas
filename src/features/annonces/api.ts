import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
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

// Seuls le titre et le message se corrigent : l'auteur et la date de publication restent ceux d'origine
export async function modifierAnnonce(id: string, titre: string, contenu: string): Promise<void> {
  await updateDoc(doc(db, 'annonces', id), { titre: titre.trim(), contenu: contenu.trim() })
}

export async function supprimerAnnonce(id: string): Promise<void> {
  await deleteDoc(doc(db, 'annonces', id))
}
