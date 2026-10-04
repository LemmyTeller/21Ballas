import { addDoc, collection, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { nomAffiche } from '../../lib/roles'
import type { Membre } from '../../types'

export async function creerAmende(
  saisie: {
    membre: Membre
    delit: string
    // null : maintenant, à l'heure du serveur
    date: Date | null
    note: string
  },
  auteurUid: string,
): Promise<void> {
  await addDoc(collection(db, 'amendes'), {
    membreUid: saisie.membre.uid,
    membreNom: nomAffiche(saisie.membre),
    delit: saisie.delit,
    date: saisie.date ? Timestamp.fromDate(saisie.date) : serverTimestamp(),
    note: saisie.note.trim(),
    creeParUid: auteurUid,
    createdAt: serverTimestamp(),
  })
}

// Seule la note se corrige : le joueur, le délit et la date fixent la récidive
export async function majAmende(id: string, note: string): Promise<void> {
  await updateDoc(doc(db, 'amendes', id), { note: note.trim() })
}

export async function supprimerAmende(id: string): Promise<void> {
  await deleteDoc(doc(db, 'amendes', id))
}
