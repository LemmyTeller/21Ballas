import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Caisse, Recolte, Transformation } from '../../types'

const requeteCaisses = () => collection(db, 'caisses')
const versCaisse = (id: string, data: DocumentData) => ({ id, ...data }) as Caisse

// Commandes de caisses, en attente et closes
export function useCaisses() {
  return useCollection(requeteCaisses, versCaisse)
}

const requeteLots = () => collection(db, 'transformations')
const versLot = (id: string, data: DocumentData) => ({ id, ...data }) as Transformation

// Lots passés à l'établi, en cours et récupérés
export function useTransformations() {
  return useCollection(requeteLots, versLot)
}

const requeteRecoltes = () => collection(db, 'recoltes')
const versRecolte = (id: string, data: DocumentData) => ({ id, ...data }) as Recolte

// Journal des récoltes de plans
export function useRecoltes() {
  return useCollection(requeteRecoltes, versRecolte)
}
