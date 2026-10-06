import { deleteField, doc, FieldPath, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

// Un seul event à la fois : tout tient dans ce document
export const refEvent = () => doc(db, 'events', 'courant')

// Ajoute un item à l'event, ou change ce qu'il rapporte par unité
export async function reglerPoints(reference: string, points: number): Promise<void> {
  await setDoc(refEvent(), { points: { [reference]: points }, updatedAt: serverTimestamp() }, { merge: true })
}

export async function retirerItem(reference: string): Promise<void> {
  // FieldPath : une clé d'arme (« arme-12 ») ne passe pas dans un chemin écrit avec des points
  await updateDoc(refEvent(), new FieldPath('points', reference), deleteField(), 'updatedAt', serverTimestamp())
}

export async function renommerEvent(nom: string): Promise<void> {
  await setDoc(refEvent(), { nom: nom.trim(), updatedAt: serverTimestamp() }, { merge: true })
}

// Repart d'un event vierge. Le Stock n'est pas touché.
export async function viderEvent(): Promise<void> {
  await setDoc(refEvent(), { nom: '', points: {}, updatedAt: serverTimestamp() })
}
