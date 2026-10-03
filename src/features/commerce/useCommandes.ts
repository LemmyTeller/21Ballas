import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Commande } from '../../types'

const requete = () => collection(db, 'commandes')
const versCommande = (id: string, data: DocumentData) => ({ id, ...data, lignes: data.lignes ?? [] }) as Commande

export function useCommandes() {
  return useCollection(requete, versCommande)
}
