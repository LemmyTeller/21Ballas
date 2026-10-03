import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatNombre, formatPrix } from '../../lib/format'
import type { Article, CommerceVille, Lieu } from '../../types'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'
import { quantiteDans } from '../stock/useArticles'
import { formatDuree, lancerBlanchiment, nomCommerce, propreAttendu } from './api'

// Dépôt d'argent sale dans un de nos commerces : montant, taux et durée (ceux du commerce par défaut),
// et lieu d'où sortent les billets de 1$
export function LancementModal({
  commerce,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  commerce: CommerceVille
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  const [montant, setMontant] = useState('')
  const [taux, setTaux] = useState(commerce.taux?.toString() ?? '')
  const [heures, setHeures] = useState(commerce.dureeMinutes === null ? '' : String(Math.floor(commerce.dureeMinutes / 60)))
  const [minutes, setMinutes] = useState(commerce.dureeMinutes === null ? '' : String(commerce.dureeMinutes % 60))
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Heure d'ouverture de la fenêtre, pour estimer l'heure de fin (la vraie part du moment du lancement)
  const [ouverture] = useState(() => Date.now())

  const dureeMinutes = Number(heures) * 60 + Number(minutes)
  // Plafond du commerce, s'il est connu
  const max = commerce.montantMax ?? null
  const depasse = max !== null && Number(montant) > max
  const complet = Number(montant) > 0 && !depasse && taux !== '' && (heures !== '' || minutes !== '')
  const billets = articles.find((a) => a.id === REFERENCE_ARGENT_SALE)
  const disponible = billets && lieuId ? quantiteDans(billets, lieuId) : 0

  async function lancer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await lancerBlanchiment(
        commerce,
        { montant: Number(montant), taux: Number(taux), dureeMinutes, lieuId: lieuId || null },
        acteurUid,
        articles,
      )
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Blanchir — ${nomCommerce(commerce)}`} onClose={onClose}>
      <form onSubmit={lancer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">
            Montant en sale ($){max !== null && ` — maximum ${formatPrix(max)}`}
          </span>
          <input
            type="number"
            className={inputClass}
            value={montant}
            min={1}
            max={max ?? undefined}
            step={1}
            required
            autoFocus
            onChange={(e) => setMontant(e.target.value)}
          />
          {depasse && (
            <span className="block text-xs text-red-300">
              Ce commerce ne peut pas blanchir plus de {formatPrix(max)} à la fois.
            </span>
          )}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Taux récupéré (%)</span>
            <input
              type="number"
              className={inputClass}
              value={taux}
              min={0}
              max={100}
              step="any"
              required
              onChange={(e) => setTaux(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Durée : heures</span>
            <input
              type="number"
              className={inputClass}
              value={heures}
              min={0}
              step={1}
              onChange={(e) => setHeures(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">minutes</span>
            <input
              type="number"
              className={inputClass}
              value={minutes}
              min={0}
              max={59}
              step={1}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Les billets de 1$ sortent de</span>
          <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom} ({formatNombre(billets ? quantiteDans(billets, l.id) : 0)} billets)
              </option>
            ))}
            <option value="">Ne pas toucher au stock</option>
          </select>
        </label>

        {complet && (
          <dl className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-400">Propre attendu</dt>
              <dd className="font-semibold text-emerald-400 tabular-nums">
                {formatPrix(propreAttendu(Number(montant), Number(taux)))}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-400">Prêt dans</dt>
              <dd className="font-semibold text-zinc-100">
                {formatDuree(dureeMinutes)} (vers{' '}
                {new Date(ouverture + dureeMinutes * 60_000).toLocaleTimeString('fr-FR', { timeStyle: 'short' })})
              </dd>
            </div>
            {lieuId && Number(montant) > disponible && (
              <p className="pt-1 text-xs text-amber-300">
                Seulement {formatNombre(disponible)} billets dans ce lieu : son stock tombera à 0.
              </p>
            )}
          </dl>
        )}

        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !complet}>
            Lancer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
