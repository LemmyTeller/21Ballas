import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { pochonsPour } from '../../lib/biz'
import { formatNombre } from '../../lib/format'
import type { Article, Lieu, Transformation } from '../../types'
import { recupererLot } from './api'

// Récupération des pochons d'un ancien lot terminé à l'établi (on n'en lance plus : voir la zone de transformation)
export function LotModal({
  lot,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  lot: Transformation
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await recupererLot(lot, lieuId || null, acteurUid, articles)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title="Récupérer les pochons" onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <p className="text-sm text-zinc-300">
          {formatNombre(lot.tetes)} têtes transformées :{' '}
          <span className="font-semibold text-emerald-400">+{formatNombre(pochonsPour(lot.tetes))} pochons de weed</span>
        </p>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Pochons stockés dans</span>
          <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
            <option value="">Ne pas toucher au stock</option>
          </select>
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi}>
            Récupérer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
