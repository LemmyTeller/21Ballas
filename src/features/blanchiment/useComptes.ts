import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { CompteBlanchiment, OperationBlanchiment } from '../../types'

const requeteComptes = () => collection(db, 'comptesBlanchiment')
const versCompte = (id: string, data: DocumentData) => ({ id, ...data }) as CompteBlanchiment

// État de nos commerces au dernier relevé ; l'id d'un compte est celui de son commerce
export function useComptes() {
  return useCollection(requeteComptes, versCompte)
}

const requeteOperations = () => collection(db, 'operationsBlanchiment')
const versOperation = (id: string, data: DocumentData) => ({ id, ...data }) as OperationBlanchiment

// Journal des ajouts de sale, retraits de propre et relevés
export function useOperations() {
  return useCollection(requeteOperations, versOperation)
}
