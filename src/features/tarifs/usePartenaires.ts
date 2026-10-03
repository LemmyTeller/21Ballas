import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Partenaire } from '../../types'

const requete = () => collection(db, 'partenaires')
const versPartenaire = (id: string, data: DocumentData) => ({ id, ...data }) as Partenaire

export function usePartenaires() {
  return useCollection(requete, versPartenaire)
}
