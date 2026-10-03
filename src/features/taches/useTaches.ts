import { collection, orderBy, query, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Tache } from '../../types'

const requete = () => query(collection(db, 'taches'), orderBy('ordre'))
const versTache = (id: string, data: DocumentData) => ({ id, ...data }) as Tache

export function useTaches() {
  return useCollection(requete, versTache)
}
