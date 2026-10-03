import { collection, orderBy, query, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Lieu } from '../../types'

// Dans l'ordre de création : le premier lieu saisi (le QG) reste en tête
const requete = () => query(collection(db, 'lieux'), orderBy('createdAt'))
const versLieu = (id: string, data: DocumentData) => ({ id, ...data }) as Lieu

export function useLieux() {
  return useCollection(requete, versLieu)
}
