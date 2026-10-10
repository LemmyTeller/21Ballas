import { Link } from 'react-router-dom'
import { Card, Chargement, ErrorMessage } from '../../components/ui'
import { COULEURS_PLAN, ETAPE_LABELS, etatPlan } from '../../lib/carte'
import { formatNombre, formatRestant } from '../../lib/format'
import { useMaintenant } from '../../lib/presence'
import { usePoints } from './usePoints'

const ORDRE_ETATS = ['pret', 'arroser', 'pousse']

// Résumé pour l'accueil : les plans de récolte posés sur la carte, ceux qui demandent une action d'abord.
// Arroser et récolter se font depuis l'onglet Map.
export function Jardinage() {
  const points = usePoints()
  const maintenant = useMaintenant()

  const plans = points.data
    .filter((p) => p.type === 'plan')
    .map((point) => ({ point, ...etatPlan(point, maintenant) }))
    .sort((a, b) => ORDRE_ETATS.indexOf(a.etat) - ORDRE_ETATS.indexOf(b.etat) || a.restant - b.restant)

  return (
    <Card
      className="p-4!"
      title="Jardinage"
      action={
        <Link to="/map" className="text-xs text-zinc-500 hover:text-purple-300">
          Voir la carte
        </Link>
      }
    >
      <ErrorMessage>{points.error}</ErrorMessage>
      {points.loading ? (
        <Chargement />
      ) : plans.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun plan en cours.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {plans.map(({ point, etat, restant }, index) => (
            <li key={point.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-zinc-100">{point.commentaire || `Plan ${index + 1}`}</span>
                <span className="text-zinc-500">
                  {' '}
                  · {formatNombre(point.quantite ?? 0)} plants{point.etape && ` · ${ETAPE_LABELS[point.etape]}`}
                </span>
              </span>
              <span className="font-medium whitespace-nowrap tabular-nums" style={{ color: COULEURS_PLAN[etat] }}>
                {etat === 'pret' ? 'Prêt' : etat === 'arroser' ? 'À arroser' : formatRestant(restant)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
