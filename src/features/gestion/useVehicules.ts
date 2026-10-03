import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Vehicule } from '../../types'

const requete = () => collection(db, 'vehicules')
const versVehicule = (id: string, data: DocumentData) => ({ id, ...data }) as Vehicule

export function useVehicules() {
  return useCollection(requete, versVehicule)
}
