import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Reference } from '../../types'
import { reglerPoints } from './api'

// Ajoute un item à l'event avec ce qu'il rapporte par unité, ou (avec `item`) change les points d'un item déjà compté
export function ItemEventModal({
  catalogue,
  item,
  pointsActuels,
  onClose,
}: {
  // Items pas encore dans l'event
  catalogue: Reference[]
  item?: { cle: string; nom: string }
  pointsActuels?: number
  onClose: () => void
}) {
  const [selection, setSelection] = useState<Reference | null>(null)
  const [points, setPoints] = useState(pointsActuels !== undefined ? String(pointsActuels) : '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const cle = item?.cle ?? selection?.cle
  const valeur = Number(points)
  const valide = cle !== undefined && points !== '' && valeur >= 0

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    try {
      await reglerPoints(cle, valeur)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={item ? `Points — ${item.nom}` : 'Ajouter un item à l’event'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {!item && <SelecteurReference catalogue={catalogue} selection={selection} onSelection={setSelection} />}
        {cle !== undefined && (
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Points par unité</span>
            <input
              type="number"
              className={inputClass}
              value={points}
              min={0}
              step="any"
              required
              autoFocus
              onChange={(e) => setPoints(e.target.value)}
            />
          </label>
        )}
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !valide}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
