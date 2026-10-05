import { useEffect, useState } from 'react'
import type { Membre } from '../types'

// Sans activité dans l'appli, une présence retombe d'elle-même à « absent » après ce délai.
// `presenceAt` est l'heure de la dernière activité : voir usePresenceActive.
export const DUREE_PRESENCE_H = 4

export function estPresent(membre: Pick<Membre, 'present' | 'presenceAt'>, maintenant: number): boolean {
  if (!membre.present) return false
  // presenceAt est null le temps que le serveur confirme l'heure du clic
  if (!membre.presenceAt) return true
  return maintenant - membre.presenceAt.toMillis() < DUREE_PRESENCE_H * 3_600_000
}

// Heure courante, rafraîchie chaque minute pour faire expirer les présences à l'écran
export function useMaintenant(): number {
  const [maintenant, setMaintenant] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  return maintenant
}
