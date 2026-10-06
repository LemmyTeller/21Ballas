import { onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { EventCourse } from '../../types'
import { refEvent } from './api'

const EVENT_VIDE: EventCourse = { nom: '', points: {} }

// L'event en cours, en temps réel. Tant qu'aucun gradé ne l'a réglé, le document n'existe pas : event vide.
export function useEvent() {
  const [etat, setEtat] = useState<{ data: EventCourse; loading: boolean; error: string | null }>({
    data: EVENT_VIDE,
    loading: true,
    error: null,
  })

  useEffect(
    () =>
      onSnapshot(
        refEvent(),
        (snap) => {
          const data = snap.data()
          setEtat({ data: { nom: data?.nom ?? '', points: data?.points ?? {} }, loading: false, error: null })
        },
        (e) => setEtat({ data: EVENT_VIDE, loading: false, error: e.message }),
      ),
    [],
  )

  return etat
}
