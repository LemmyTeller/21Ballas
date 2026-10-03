import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Annonce } from '../../types'

const requete = () => query(collection(db, 'annonces'), orderBy('createdAt', 'desc'), limit(20))
const versAnnonce = (id: string, data: DocumentData) => ({ id, ...data }) as Annonce

export function useAnnonces() {
  return useCollection(requete, versAnnonce)
}
