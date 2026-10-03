import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Membre } from '../../types'

const requete = () => collection(db, 'users')
const versMembre = (id: string, data: DocumentData) => ({ uid: id, ...data }) as Membre

export function useMembres() {
  return useCollection(requete, versMembre)
}
