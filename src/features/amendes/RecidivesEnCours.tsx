import { Link } from 'react-router-dom'
import { Card, Chargement, ErrorMessage } from '../../components/ui'
import { finRecidive, formatRestant, nomDelit, recidivesEnCours } from '../../lib/delits'
import { useMaintenant } from '../../lib/presence'
import { useAmendes } from './useAmendes'

// Résumé pour l'accueil : qui est en récidive, sur quel délit, et pour combien de temps encore.
// La saisie et l'historique sont dans l'onglet Amendes.
export function RecidivesEnCours() {
  const amendes = useAmendes()
  const maintenant = useMaintenant()

  // Celles qui finissent le plus tôt d'abord
  const enCours = [...recidivesEnCours(amendes.data, maintenant).values()].sort(
    (a, b) => finRecidive(a) - finRecidive(b),
  )

  return (
    <Card
      className="p-4!"
      title="Récidives en cours"
      action={
        <Link to="/amendes" className="text-xs text-zinc-500 hover:text-purple-300">
          Voir tout
        </Link>
      }
    >
      <ErrorMessage>{amendes.error}</ErrorMessage>
      {amendes.loading ? (
        <Chargement />
      ) : enCours.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune récidive en cours.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {enCours.map((amende) => (
            <li key={amende.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate" title={`${amende.membreNom} · ${nomDelit(amende.delit)}`}>
                <span className="font-semibold text-zinc-100">{amende.membreNom}</span>
                <span className="text-zinc-500"> · {nomDelit(amende.delit)}</span>
              </span>
              <span className="font-medium whitespace-nowrap text-amber-300 tabular-nums">
                {formatRestant(finRecidive(amende) - maintenant)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
