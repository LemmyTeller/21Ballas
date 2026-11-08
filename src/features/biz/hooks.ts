import { collection, onSnapshot, type DocumentData } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { MouvementStock, Transformation, ZoneTransformation } from '../../types'
import { refZone } from './api'

// État de la zone de transformation, en temps réel ; `undefined` tant qu'elle n'a jamais servi
export function useZone() {
  const [etat, setEtat] = useState<{ data: ZoneTransformation | undefined; loading: boolean; error: string | null }>({
    data: undefined,
    loading: true,
    error: null,
  })

  useEffect(
    () =>
      onSnapshot(
        refZone(),
        (snap) => setEtat({ data: snap.data() as ZoneTransformation | undefined, loading: false, error: null }),
        (e) => setEtat({ data: undefined, loading: false, error: e.message }),
      ),
    [],
  )

  return etat
}

const requeteMouvements = () => collection(db, 'mouvementsStock')
const versMouvement = (id: string, data: DocumentData) => ({ id, ...data }) as MouvementStock

// Entrées et sorties de graines, têtes et pochons
export function useMouvements() {
  return useCollection(requeteMouvements, versMouvement)
}

const requeteLots = () => collection(db, 'transformations')
const versLot = (id: string, data: DocumentData) => ({ id, ...data }) as Transformation

// Anciens lots passés à l'établi
export function useTransformations() {
  return useCollection(requeteLots, versLot)
}
