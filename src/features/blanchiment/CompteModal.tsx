import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Estimation } from '../../lib/blanchiment'
import { formatPrix } from '../../lib/format'
import type { Article, CommerceVille, Lieu } from '../../types'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'
import { quantiteDans } from '../stock/useArticles'
import { ajouterSale, nomCommerce, releverCompte, retirerPropre } from './api'

export type ActionCompte = 'depot' | 'retrait' | 'releve'

const TITRES: Record<ActionCompte, string> = {
  depot: 'Ajouter du sale',
  retrait: 'Retirer du propre',
  releve: 'Relevé',
}

// Une action sur un de nos commerces : y ajouter du sale, en retirer du propre, ou saisir les chiffres lus en jeu.
// `estimation` : où en est le commerce à l'instant, d'après l'appli.
export function CompteModal({
  action,
  commerce,
  estimation,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  action: ActionCompte
  commerce: CommerceVille
  estimation: Estimation
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  // Retrait : tout le propre disponible par défaut. Relevé : on part des chiffres estimés.
  const [montant, setMontant] = useState(action === 'retrait' ? String(estimation.propre) : '')
  const [sale, setSale] = useState(String(estimation.sale))
  const [propre, setPropre] = useState(String(estimation.propre))
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const billets = articles.find((a) => a.id === REFERENCE_ARGENT_SALE)
  const enStock = billets && lieuId ? quantiteDans(billets, lieuId) : 0
  // Le plus gros ajout possible : la place libre du commerce, et pas plus que ce que le lieu contient
  const maxDepot = Math.min(estimation.libre ?? Infinity, lieuId ? enStock : Infinity)
  const valeur = Number(montant)

  const valide =
    action === 'releve'
      ? sale !== '' && propre !== '' && Number(sale) >= 0 && Number(propre) >= 0
      : montant !== '' && valeur > 0 && (action === 'depot' ? valeur <= maxDepot : valeur <= estimation.propre)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (action === 'depot') await ajouterSale(commerce, estimation, valeur, lieuId || null, acteurUid, articles)
      else if (action === 'retrait') await retirerPropre(commerce, estimation, valeur, acteurUid)
      else await releverCompte(commerce, { sale: Number(sale), propre: Number(propre) }, acteurUid)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`${TITRES[action]} — ${nomCommerce(commerce)}`} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <p className="text-sm text-zinc-400">
          {estimation.estimable ? 'Estimé' : 'Dernier relevé'} : sale{' '}
          <span className="font-semibold text-amber-400 tabular-nums">{formatPrix(estimation.sale)}</span> · propre{' '}
          <span className="font-semibold text-emerald-400 tabular-nums">{formatPrix(estimation.propre)}</span>
          {estimation.libre !== null && <> · place libre {formatPrix(estimation.libre)}</>}
        </p>

        {action === 'releve' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Sale affiché en jeu ($)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={sale}
                  min={0}
                  step={1}
                  required
                  autoFocus
                  onChange={(e) => setSale(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Propre affiché en jeu ($)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={propre}
                  min={0}
                  step={1}
                  required
                  onChange={(e) => setPropre(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Recopie la ligne « Stock » du commerce. L’estimation repart de ces chiffres, à l’heure du relevé.
            </p>
          </>
        ) : (
          <>
            {action === 'depot' && (
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Billets de 1$ pris dans</span>
                <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
                  {lieux.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom}
                    </option>
                  ))}
                  <option value="">Ne pas toucher au stock</option>
                </select>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">
                {action === 'depot' ? 'Sale à ajouter ($)' : 'Propre à retirer ($)'}
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputClass}
                  value={montant}
                  min={1}
                  step={1}
                  required
                  autoFocus
                  onChange={(e) => setMontant(e.target.value)}
                />
                {action === 'depot' && Number.isFinite(maxDepot) && (
                  <Button variant="ghost" disabled={maxDepot <= 0} onClick={() => setMontant(String(Math.floor(maxDepot)))}>
                    Max
                  </Button>
                )}
              </div>
            </label>
            {action === 'depot' && (
              <p className="text-xs text-zinc-500">
                {lieuId && `${formatPrix(enStock)} de sale dans ce lieu. `}
                {estimation.libre !== null
                  ? `Au plus ${formatPrix(estimation.libre)} : la place libre sous le plafond.`
                  : 'Plafond inconnu : aucune limite n’est appliquée.'}
              </p>
            )}
            {action === 'retrait' && (
              <p className="text-xs text-zinc-500">
                Le retrait est noté dans l’historique et libère de la place pour remettre du sale. Il ne touche pas au
                Stock.
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
