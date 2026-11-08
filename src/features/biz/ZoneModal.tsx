import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { REFERENCE_POCHON, SECONDES_PAR_TETE, TETES_PAR_POCHON, type EtatZone } from '../../lib/biz'
import { REFERENCE_TETE } from '../../lib/carte'
import { formatNombre, formatRestant } from '../../lib/format'
import type { Article, Lieu } from '../../types'
import { quantiteDans } from '../stock/useArticles'
import { deposerPochons, deposerTetes, releverZone, retirerPochons } from './api'

// `depot` : des têtes à transformer ; `depotPochons` : des pochons à ranger (la zone sert aussi de stockage)
export type ActionZone = 'depot' | 'depotPochons' | 'retrait' | 'releve'

const TITRES: Record<ActionZone, string> = {
  depot: 'Déposer des têtes',
  depotPochons: 'Déposer des pochons',
  retrait: 'Retirer des pochons',
  releve: 'Relevé de la zone',
}

// Une action sur la zone de transformation. `etat` : son état affiché ; `exact` : le même, non arrondi, d'où
// repart le nouvel état enregistré.
export function ZoneModal({
  action,
  etat,
  exact,
  lieux,
  articles,
  onClose,
}: {
  action: ActionZone
  etat: EtatZone
  exact: { tetes: number; pochons: number }
  lieux: Lieu[]
  articles: Article[]
  onClose: () => void
}) {
  // Retrait : tous les pochons prêts par défaut. Relevé : on part des chiffres estimés.
  const [quantite, setQuantite] = useState(action === 'retrait' ? String(etat.pochons) : '')
  const [tetes, setTetes] = useState(String(etat.tetes))
  const [pochons, setPochons] = useState(String(etat.pochons))
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Item qui sort du lieu choisi lors d'un dépôt : des têtes, ou des pochons
  const article = articles.find((a) => a.id === (action === 'depotPochons' ? REFERENCE_POCHON : REFERENCE_TETE))
  const enStock = article && lieuId ? quantiteDans(article, lieuId) : 0
  // Le plus gros dépôt possible : pas plus que ce que le lieu contient, et pour des têtes, la place libre de la zone
  const maxDepot = Math.min(action === 'depot' ? etat.libre : Infinity, lieuId ? enStock : Infinity)
  const nombre = Math.trunc(Number(quantite))
  const depose = action === 'depot' || action === 'depotPochons'

  const valide =
    action === 'releve'
      ? tetes !== '' && pochons !== '' && Number(tetes) >= 0 && Number(pochons) >= 0
      : quantite !== '' && nombre > 0 && nombre <= (depose ? maxDepot : etat.pochons)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (action === 'depot') await deposerTetes(exact, nombre, lieuId || null, articles)
      else if (action === 'depotPochons') await deposerPochons(exact, nombre, lieuId || null, articles)
      else if (action === 'retrait') await retirerPochons(exact, nombre, lieuId || null, articles)
      else await releverZone({ tetes: Number(tetes), pochons: Number(pochons) })
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={TITRES[action]} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <p className="text-sm text-zinc-400">
          Dans la zone : <span className="font-semibold text-zinc-100 tabular-nums">{formatNombre(etat.tetes)}</span>{' '}
          têtes à transformer ·{' '}
          <span className="font-semibold text-emerald-400 tabular-nums">{formatNombre(etat.pochons)}</span> pochons prêts
        </p>

        {action === 'releve' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Têtes affichées en jeu</span>
                <input
                  type="number"
                  className={inputClass}
                  value={tetes}
                  min={0}
                  step={1}
                  required
                  autoFocus
                  onChange={(e) => setTetes(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Pochons affichés en jeu</span>
                <input
                  type="number"
                  className={inputClass}
                  value={pochons}
                  min={0}
                  step={1}
                  required
                  onChange={(e) => setPochons(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">L’estimation repart de ces chiffres, à l’heure du relevé.</p>
          </>
        ) : (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">
                {action === 'depot' ? 'Têtes prises dans' : action === 'depotPochons' ? 'Pochons pris dans' : 'Pochons rangés dans'}
              </span>
              <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
                {lieux.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
                <option value="">{depose ? 'Ne pas toucher au stock' : 'Nulle part : partent en go-fast'}</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">
                {action === 'depot' ? 'Têtes à déposer' : action === 'depotPochons' ? 'Pochons à déposer' : 'Pochons à retirer'}
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputClass}
                  value={quantite}
                  min={1}
                  step={1}
                  required
                  autoFocus
                  onChange={(e) => setQuantite(e.target.value)}
                />
                {depose && Number.isFinite(maxDepot) && (
                  <Button variant="ghost" disabled={maxDepot <= 0} onClick={() => setQuantite(String(maxDepot))}>
                    Max
                  </Button>
                )}
              </div>
            </label>
            {action === 'depot' && (
              <p className="text-xs text-zinc-500">
                {lieuId && `${formatNombre(enStock)} têtes dans ce lieu. `}
                Place libre dans la zone : {formatNombre(etat.libre)} têtes.
                {valide &&
                  ` ${formatNombre(Math.floor(nombre / TETES_PAR_POCHON))} pochons en plus, en ${formatRestant(nombre * SECONDES_PAR_TETE * 1000)}.`}
              </p>
            )}
            {action === 'depotPochons' && (
              <p className="text-xs text-zinc-500">
                {lieuId && `${formatNombre(enStock)} pochons dans ce lieu. `}
                Ils s’ajoutent aux pochons de la zone, qui sert aussi de stockage pour les go-fast.
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
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
