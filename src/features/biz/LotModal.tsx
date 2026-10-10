import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { SECONDES_PAR_TETE, TETES_MAX, TETES_PAR_POCHON, pochonsPour } from '../../lib/biz'
import { REFERENCE_TETE } from '../../lib/carte'
import { formatNombre, formatRestant } from '../../lib/format'
import type { Article, Lieu, Transformation } from '../../types'
import { quantiteDans } from '../stock/useArticles'
import { lancerLot, recupererLot } from './api'

// Sans `lot` : pose d'un lot de têtes sur l'établi. Avec : récupération des pochons d'un lot terminé.
export function LotModal({
  lot,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  lot?: Transformation
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [quantite, setQuantite] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const articleTete = articles.find((a) => a.id === REFERENCE_TETE)
  const disponible = articleTete && lieuId ? quantiteDans(articleTete, lieuId) : 0
  // Le plus gros lot possible : pair, pas plus que l'établi ne prend, ni que le lieu ne contient
  const maximum = Math.floor(Math.min(TETES_MAX, lieuId ? disponible : TETES_MAX) / TETES_PAR_POCHON) * TETES_PAR_POCHON
  const tetes = Math.trunc(Number(quantite))
  const valide = lot !== undefined || (tetes >= TETES_PAR_POCHON && tetes <= maximum && tetes % TETES_PAR_POCHON === 0)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (lot) await recupererLot(lot, lieuId || null, acteurUid, articles)
      else await lancerLot(tetes, lieuId || null, acteurUid, articles)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={lot ? 'Récupérer les pochons' : 'Lancer un lot à l’établi'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {lot && (
          <p className="text-sm text-zinc-300">
            {formatNombre(lot.tetes)} têtes transformées :{' '}
            <span className="font-semibold text-emerald-400">+{formatNombre(pochonsPour(lot.tetes))} pochons de weed</span>
          </p>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">{lot ? 'Pochons stockés dans' : 'Têtes prises dans'}</span>
          <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
            <option value="">Ne pas toucher au stock</option>
          </select>
        </label>

        {!lot && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Nombre de têtes</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputClass}
                  value={quantite}
                  min={TETES_PAR_POCHON}
                  max={maximum}
                  step={TETES_PAR_POCHON}
                  required
                  autoFocus
                  onChange={(e) => setQuantite(e.target.value)}
                />
                <Button variant="ghost" disabled={maximum < TETES_PAR_POCHON} onClick={() => setQuantite(String(maximum))}>
                  Max
                </Button>
              </div>
            </label>
            <p className="text-xs text-zinc-500">
              {lieuId && `${formatNombre(disponible)} têtes dans ce lieu. `}
              {TETES_PAR_POCHON} têtes par pochon, {TETES_MAX} têtes au plus par lot, nombre pair.
            </p>
            {valide && (
              <p className="text-sm text-zinc-300">
                <span className="font-semibold text-emerald-400">{formatNombre(pochonsPour(tetes))} pochons</span> dans{' '}
                {formatRestant(tetes * SECONDES_PAR_TETE * 1000)}.
              </p>
            )}
          </>
        )}

        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !valide}>
            {lot ? 'Récupérer' : 'Lancer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
