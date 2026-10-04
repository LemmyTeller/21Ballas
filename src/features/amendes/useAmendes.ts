import { collection, orderBy, query, Timestamp, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Amende } from '../../types'

const requete = () => query(collection(db, 'amendes'), orderBy('date', 'desc'))
// `date` est null le temps que le serveur confirme l'heure d'une amende saisie « maintenant »
const versAmende = (id: string, data: DocumentData) => ({ id, ...data, date: data.date ?? Timestamp.now() }) as Amende

// Toutes les amendes, de la plus récente à la plus ancienne
export function useAmendes() {
  return useCollection(requete, versAmende)
}
