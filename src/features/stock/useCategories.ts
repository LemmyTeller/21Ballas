import { collection, orderBy, query, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { CategorieStock } from '../../types'

const requete = () => query(collection(db, 'categoriesStock'), orderBy('createdAt'))
const versCategorie = (id: string, data: DocumentData) => ({ id, ...data }) as CategorieStock

export function useCategories() {
  return useCollection(requete, versCategorie)
}
