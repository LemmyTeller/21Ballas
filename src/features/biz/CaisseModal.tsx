import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { GRAINES_PAR_CAISSE, grainesAttendues } from '../../lib/biz'
import { formatNombre } from '../../lib/format'
import type { Article, Caisse, Lieu } from '../../types'
import { cloreCaisses, commanderCaisses } from './api'

// Sans `caisse` : nouvelle commande de caisses. Avec : sa clôture, où l'on note combien de graines ont été
// récupérées (une caisse se vide graine par graine, on peut être interrompu) et où elles vont.
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
  const attendues = caisse ? grainesAttendues(caisse) : 0
  // Commande : nombre de caisses. Clôture : nombre de graines, toutes par défaut.
  const [quantite, setQuantite] = useState(caisse ? String(attendues) : '1')
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const nombre = Math.trunc(Number(quantite))
  const valide = quantite !== '' && (caisse ? nombre >= 0 && nombre <= attendues : nombre >= 1 && nombre <= 100)
  const perdues = attendues - nombre

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
            {caisse
              ? `Graines récupérées, sur ${attendues} (${caisse.quantite} caisse${caisse.quantite > 1 ? 's' : ''})`
              : 'Nombre de caisses'}
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              className={inputClass}
              value={quantite}
              min={caisse ? 0 : 1}
              max={caisse ? attendues : 100}
              step={1}
              required
              autoFocus
              onChange={(e) => setQuantite(e.target.value)}
            />
            {caisse && (
              <>
                <Button variant="ghost" onClick={() => setQuantite(String(attendues))}>
                  Tout
                </Button>
                <Button variant="ghost" onClick={() => setQuantite('0')}>
                  Rien
                </Button>
              </>
            )}
          </div>
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
                <span className="font-semibold text-emerald-400">+{formatNombre(nombre)} graines de weed</span>
                {perdues > 0 && (
                  <span className="text-red-300">
                    {' '}
                    · {formatNombre(perdues)} graine{perdues > 1 ? 's' : ''} perdue{perdues > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Compte les graines réellement sorties des caisses, même si tu as été interrompu en cours de route. Une
              fois close, la commande part dans l’historique et ne se modifie plus.
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            {GRAINES_PAR_CAISSE} graines par caisse. La commande reste en attente jusqu’à ce que tu indiques combien de
            graines ont été récupérées.
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
