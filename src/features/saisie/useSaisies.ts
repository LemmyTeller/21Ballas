import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Saisie } from '../../types'

const requete = () => collection(db, 'saisies')
const versSaisie = (id: string, data: DocumentData) => ({ id, ...data, quantites: data.quantites ?? {} }) as Saisie

// Toutes les journées saisies : celle du jour et l'historique
export function useSaisies() {
  return useCollection(requete, versSaisie)
}
