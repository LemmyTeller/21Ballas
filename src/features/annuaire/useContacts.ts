import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Contact } from '../../types'

const requete = () => collection(db, 'contacts')
const versContact = (id: string, data: DocumentData) => ({ id, ...data }) as Contact

export function useContacts() {
  return useCollection(requete, versContact)
}
