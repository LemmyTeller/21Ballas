import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { CommerceVille } from '../../types'

const requete = () => collection(db, 'commerces')
const versCommerce = (id: string, data: DocumentData) => ({ id, ...data }) as CommerceVille

export function useCommerces() {
  return useCollection(requete, versCommerce)
}
