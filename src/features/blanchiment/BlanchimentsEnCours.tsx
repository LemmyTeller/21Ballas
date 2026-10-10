import { Link } from 'react-router-dom'
import { Card, Chargement, ErrorMessage } from '../../components/ui'
import { estimerCompte } from '../../lib/blanchiment'
import { formatPrix } from '../../lib/format'
import { useMaintenant } from '../../lib/presence'
import { PROPRIETAIRE_NOUS, formatDuree } from './api'
import { useCommerces } from './useCommerces'
import { useComptes } from './useComptes'

// Résumé pour l'accueil : nos commerces, le propre qui y attend, et quand il faudra y remettre du sale.
// Ajouts, retraits et relevés se font dans l'onglet Blanchiment.
export function BlanchimentsEnCours() {
  const commerces = useCommerces()
  const comptes = useComptes()
  const maintenant = useMaintenant()

  // Ceux à recharger d'abord, puis ceux qui seront vides le plus tôt
  const nos = commerces.data
    .filter((c) => c.proprietaireId === PROPRIETAIRE_NOUS)
    .map((commerce) => ({
      commerce,
      etat: estimerCompte(
        comptes.data.find((c) => c.id === commerce.id),
        commerce,
        maintenant,
      ),
    }))
    .sort(
      (a, b) =>
        (a.etat.minutesAvantVide ?? Infinity) - (b.etat.minutesAvantVide ?? Infinity) ||
        a.commerce.zip.localeCompare(b.commerce.zip, 'fr', { numeric: true }),
    )

  return (
    <Card
      className="p-4!"
      title="Blanchiment"
      action={
        <Link to="/blanchiment" className="text-xs text-zinc-500 hover:text-purple-300">
          Voir tout
        </Link>
      }
    >
      <ErrorMessage>{commerces.error ?? comptes.error}</ErrorMessage>
      {commerces.loading || comptes.loading ? (
        <Chargement />
      ) : nos.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun commerce à nous.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {nos.map(({ commerce, etat }) => (
            <li key={commerce.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-zinc-100 tabular-nums">{commerce.zip}</span>
                <span className="text-zinc-500"> · </span>
                <span className="font-medium text-emerald-400 tabular-nums">{formatPrix(etat.propre)}</span>
                <span className="text-zinc-500"> propre</span>
              </span>
              <span
                className={`font-medium whitespace-nowrap ${
                  !etat.estimable ? 'text-zinc-500' : etat.sale > 0 ? 'text-amber-300' : 'text-red-400'
                }`}
              >
                {!etat.estimable
                  ? 'Non estimé'
                  : etat.sale > 0
                    ? `Vide dans ${formatDuree(Math.ceil(etat.minutesAvantVide ?? 0))}`
                    : 'À recharger'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
