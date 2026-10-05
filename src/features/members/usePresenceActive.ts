import { useEffect, useRef } from 'react'
import { estPresent } from '../../lib/presence'
import type { Membre } from '../../types'
import { basculerPresence } from './api'

// Entre deux prolongations, pour ne pas écrire à chaque clic
const INTERVALLE_MS = 10 * 60_000

// Tant qu'un membre présent se sert de l'appli (clic, touche), sa présence est prolongée : elle ne retombe
// qu'après 4 h sans aucune activité. Une présence déjà expirée ne repart pas toute seule.
export function usePresenceActive({ uid, present, presenceAt }: Pick<Membre, 'uid' | 'present' | 'presenceAt'>) {
  const derniereTentative = useRef(0)

  useEffect(() => {
    function activite() {
      const maintenant = Date.now()
      if (!presenceAt || !estPresent({ present, presenceAt }, maintenant)) return
      if (maintenant - presenceAt.toMillis() < INTERVALLE_MS) return
      if (maintenant - derniereTentative.current < INTERVALLE_MS) return
      derniereTentative.current = maintenant
      basculerPresence(uid, true).catch(() => {})
    }

    window.addEventListener('pointerdown', activite)
    window.addEventListener('keydown', activite)
    return () => {
      window.removeEventListener('pointerdown', activite)
      window.removeEventListener('keydown', activite)
    }
  }, [uid, present, presenceAt])
}
