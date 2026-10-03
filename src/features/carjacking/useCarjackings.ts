import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Carjacking } from '../../types'

const requete = () => collection(db, 'carjackings')
const versCarjacking = (id: string, data: DocumentData) => ({ id, ...data }) as Carjacking

// Voitures à voler, en cours et closes (historique)
export function useCarjackings() {
  return useCollection(requete, versCarjacking)
}
