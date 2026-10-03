import { onSnapshot, type DocumentData, type Query } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

// Écoute temps réel d'une requête Firestore. `build` doit être stable (défini hors composant)
// et `map` transforme chaque document (id + données) en objet typé.
export function useCollection<T>(
  build: () => Query<DocumentData>,
  map: (id: string, data: DocumentData) => T,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: true, error: null })

  useEffect(
    () =>
      onSnapshot(
        build(),
        (snap) => setState({ data: snap.docs.map((d) => map(d.id, d.data())), loading: false, error: null }),
        (e) => setState({ data: [], loading: false, error: e.message }),
      ),
    [build, map],
  )

  return state
}
