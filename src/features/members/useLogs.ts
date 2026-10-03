import { collection, limit, orderBy, query, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { LogEntry } from '../../types'

const requete = () => query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(200))
const versLog = (id: string, data: DocumentData) => ({ id, ...data }) as LogEntry

export function useLogs() {
  return useCollection(requete, versLog)
}
