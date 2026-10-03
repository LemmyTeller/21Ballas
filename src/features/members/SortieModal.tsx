import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage } from '../../components/ui'
import { nomAffiche } from '../../lib/roles'
import { RAISON_EFFETS, RAISON_LABELS, estSuppression } from '../../lib/sorties'
import type { Membre, RaisonSortie } from '../../types'

type Raison = Exclude<RaisonSortie, 'refus'>

// Choix de la raison pour laquelle un joueur sort du groupe. `onConfirm` applique la révocation ou la suppression.
export function SortieModal({
  cible,
  raisons,
  onConfirm,
  onClose,
}: {
  cible: Membre
  raisons: Raison[]
  onConfirm: (raison: Raison) => Promise<void>
  onClose: () => void
}) {
  const [raison, setRaison] = useState<Raison | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    if (!raison) return
    setEnvoi(true)
    setErreur(null)
    try {
      await onConfirm(raison)
      onClose()
    } catch (e) {
      setErreur((e as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Retirer ${nomAffiche(cible)} du groupe`} onClose={onClose}>
      <p className="text-sm text-zinc-400">Choisis la raison : elle détermine ce qui arrive au joueur.</p>
      <div className="space-y-2">
        {raisons.map((r) => (
          <label
            key={r}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
              raison === r ? 'border-purple-500 bg-purple-950/40' : 'border-zinc-800 hover:bg-zinc-800/50'
            }`}
          >
            <input
              type="radio"
              name="raison"
              className="mt-1 accent-purple-500"
              checked={raison === r}
              onChange={() => setRaison(r)}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-100">{RAISON_LABELS[r]}</span>
              <span className="block text-xs text-zinc-400">{RAISON_EFFETS[r]}</span>
            </span>
          </label>
        ))}
      </div>
      <ErrorMessage>{erreur}</ErrorMessage>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="danger" disabled={!raison || envoi} onClick={confirmer}>
          {raison && estSuppression(raison) ? 'Supprimer définitivement' : 'Révoquer l’accès'}
        </Button>
      </div>
    </Modal>
  )
}
