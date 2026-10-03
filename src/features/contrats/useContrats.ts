import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Contrat } from '../../types'

const requete = () => collection(db, 'contrats')
const versContrat = (id: string, data: DocumentData) => ({ id, ...data }) as Contrat

export function useContrats() {
  return useCollection(requete, versContrat)
}
