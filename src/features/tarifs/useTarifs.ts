import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Tarif } from '../../types'

const requete = () => collection(db, 'tarifs')
const versTarif = (id: string, data: DocumentData) => ({ id, ...data }) as Tarif

export function useTarifs() {
  return useCollection(requete, versTarif)
}
