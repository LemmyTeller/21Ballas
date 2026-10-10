import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { GRAINES_PAR_CAISSE } from '../../lib/biz'
import { formatNombre } from '../../lib/format'
import type { Article, Caisse, Lieu } from '../../types'
import { cloreCaisses, commanderCaisses } from './api'

// Sans `caisse` : nouvelle commande de caisses. Avec : sa clôture, où l'on note combien de caisses ont été
// récupérées (les autres sont perdues) et où vont les graines.
export function CaisseModal({
  caisse,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  caisse?: Caisse
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  const [quantite, setQuantite] = useState(caisse ? String(caisse.quantite) : '1')
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const nombre = Math.trunc(Number(quantite))
  const valide = quantite !== '' && (caisse ? nombre >= 0 && nombre <= caisse.quantite : nombre >= 1 && nombre <= 100)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (caisse) await cloreCaisses(caisse, nombre, lieuId || null, acteurUid, articles)
      else await commanderCaisses(nombre, acteurUid)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={caisse ? 'Clore la commande de caisses' : 'Commander des caisses'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">
            {caisse ? `Caisses récupérées, sur ${caisse.quantite} commandée${caisse.quantite > 1 ? 's' : ''}` : 'Nombre de caisses'}
          </span>
          <input
            type="number"
            className={inputClass}
            value={quantite}
            min={caisse ? 0 : 1}
            max={caisse ? caisse.quantite : 100}
            step={1}
            required
            autoFocus
            onChange={(e) => setQuantite(e.target.value)}
          />
        </label>

        {caisse ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Graines stockées dans</span>
              <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
                {lieux.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
                <option value="">Ne pas toucher au stock</option>
              </select>
            </label>
            {valide && (
              <p className="text-sm text-zinc-300">
                <span className="font-semibold text-emerald-400">
                  +{formatNombre(nombre * GRAINES_PAR_CAISSE)} graines de weed
                </span>
                {caisse.quantite - nombre > 0 && (
                  <span className="text-red-300">
                    {' '}
                    · {caisse.quantite - nombre} caisse{caisse.quantite - nombre > 1 ? 's' : ''} perdue
                    {caisse.quantite - nombre > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Une fois close, la commande part dans l’historique et ne se modifie plus.
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            {GRAINES_PAR_CAISSE} graines par caisse récupérée. La commande reste en attente jusqu’à ce que tu indiques
            combien de caisses sont arrivées.
          </p>
        )}

        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !valide}>
            {caisse ? 'Clore' : 'Commander'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
