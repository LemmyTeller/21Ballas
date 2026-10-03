import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Blanchiment } from '../../types'

const requete = () => collection(db, 'blanchiments')
const versBlanchiment = (id: string, data: DocumentData) => ({ id, ...data }) as Blanchiment

// Dépôts en cours et historique des dépôts récupérés
export function useBlanchiments() {
  return useCollection(requete, versBlanchiment)
}
