import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Lieu, Vehicule } from '../../types'

export type VehiculeSaisie = Pick<Vehicule, 'modele' | 'plaque' | 'proprietaireUid' | 'lieuId' | 'note'> & {
  // Nom de spawn du modèle choisi dans le catalogue ; null pour une saisie libre
  spawn: string | null
}
export type LieuSaisie = Pick<Lieu, 'nom' | 'capacite'>

function nettoyer(saisie: VehiculeSaisie): VehiculeSaisie {
  return {
    ...saisie,
    modele: saisie.modele.trim(),
    plaque: saisie.plaque.trim().toUpperCase(),
    note: saisie.note.trim(),
  }
}

export async function creerVehicule(saisie: VehiculeSaisie): Promise<void> {
  await addDoc(collection(db, 'vehicules'), {
    ...nettoyer(saisie),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function majVehicule(id: string, saisie: VehiculeSaisie): Promise<void> {
  await updateDoc(doc(db, 'vehicules', id), { ...nettoyer(saisie), updatedAt: serverTimestamp() })
}

export async function supprimerVehicule(id: string): Promise<void> {
  await deleteDoc(doc(db, 'vehicules', id))
}

export async function creerLieu(saisie: LieuSaisie): Promise<void> {
  await addDoc(collection(db, 'lieux'), { nom: saisie.nom.trim(), capacite: saisie.capacite, createdAt: serverTimestamp() })
}

export async function majLieu(id: string, saisie: LieuSaisie): Promise<void> {
  await updateDoc(doc(db, 'lieux', id), { nom: saisie.nom.trim(), capacite: saisie.capacite })
}

export async function supprimerLieu(id: string): Promise<void> {
  await deleteDoc(doc(db, 'lieux', id))
}

export async function majSolde(uid: string, montant: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { compteBancaire: montant })
}
