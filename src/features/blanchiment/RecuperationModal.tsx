import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatPrix } from '../../lib/format'
import type { Blanchiment } from '../../types'
import { propreAttendu, recupererBlanchiment } from './api'

// Récupération de l'argent propre : le montant réel peut différer de l'attendu
export function RecuperationModal({
  blanchiment,
  acteurUid,
  onClose,
}: {
  blanchiment: Blanchiment
  acteurUid: string
  onClose: () => void
}) {
  const attendu = propreAttendu(blanchiment.montant, blanchiment.taux)
  const [montant, setMontant] = useState(String(attendu))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function recuperer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await recupererBlanchiment(blanchiment.id, Number(montant), acteurUid)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Récupérer — ${blanchiment.commerceNom}`} onClose={onClose}>
      <form onSubmit={recuperer} className="space-y-3">
        <p className="text-sm text-zinc-400">
          {formatPrix(blanchiment.montant)} de sale déposés à {blanchiment.taux} % : {formatPrix(attendu)} de propre attendus.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Propre réellement récupéré ($)</span>
          <input
            type="number"
            className={inputClass}
            value={montant}
            min={0}
            step="any"
            required
            autoFocus
            onChange={(e) => setMontant(e.target.value)}
          />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || montant === ''}>
            Récupérer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
