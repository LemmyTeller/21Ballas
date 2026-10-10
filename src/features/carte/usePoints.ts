import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { PointCarte } from '../../types'

const requete = () => collection(db, 'pointsCarte')
const versPoint = (id: string, data: DocumentData) => ({ id, ...data }) as PointCarte

// Tous les points posés sur la carte
export function usePoints() {
  return useCollection(requete, versPoint)
}
