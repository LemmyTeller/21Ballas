import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Contact } from '../../types'

export type ContactSaisie = Pick<Contact, 'nom' | 'telephone' | 'role' | 'partenaireId' | 'informations'>

function nettoyer(saisie: ContactSaisie): ContactSaisie {
  return {
    ...saisie,
    nom: saisie.nom.trim(),
    telephone: saisie.telephone.trim(),
    role: saisie.role.trim(),
    informations: saisie.informations.trim(),
  }
}

export async function creerContact(saisie: ContactSaisie): Promise<void> {
  await addDoc(collection(db, 'contacts'), {
    ...nettoyer(saisie),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function majContact(id: string, saisie: ContactSaisie): Promise<void> {
  await updateDoc(doc(db, 'contacts', id), { ...nettoyer(saisie), updatedAt: serverTimestamp() })
}

export async function supprimerContact(id: string): Promise<void> {
  await deleteDoc(doc(db, 'contacts', id))
}
