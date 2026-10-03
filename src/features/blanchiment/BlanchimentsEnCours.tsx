import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chargement, ErrorMessage } from '../../components/ui'
import { GENRE_LABELS, genreCommerce } from './api'
import { useBlanchiments } from './useBlanchiments'
import { useCommerces } from './useCommerces'

// Résumé pour l'accueil : les dépôts non récupérés, avec le zip du commerce, son type et où en est le blanchiment.
// Le détail et les actions sont dans l'onglet Blanchiment.
export function BlanchimentsEnCours() {
  const depots = useBlanchiments()
  const commerces = useCommerces()
  // Rafraîchi toutes les 15 secondes : un dépôt passe à « Terminé » sans recharger la page
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  // Les dépôts terminés (à récupérer) d'abord, puis ceux qui finissent le plus tôt
  const enCours = depots.data
    .filter((d) => d.statut === 'en_cours')
    .map((depot) => ({
      depot,
      commerce: commerces.data.find((c) => c.id === depot.commerceId),
      termine: maintenant >= depot.fin.toMillis(),
    }))
    .sort((a, b) => Number(b.termine) - Number(a.termine) || a.depot.fin.toMillis() - b.depot.fin.toMillis())

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
      <ErrorMessage>{depots.error ?? commerces.error}</ErrorMessage>
      {depots.loading || commerces.loading ? (
        <Chargement />
      ) : enCours.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun blanchiment en cours.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {enCours.map(({ depot, commerce, termine }) => (
            <li key={depot.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {/* Le nom figé du dépôt sert de repli si le commerce a été supprimé entre-temps */}
                <span className="font-semibold text-zinc-100 tabular-nums">{commerce?.zip ?? depot.commerceNom}</span>
                {commerce && <span className="text-zinc-500"> · {GENRE_LABELS[genreCommerce(commerce)]}</span>}
              </span>
              <span className={`font-medium whitespace-nowrap ${termine ? 'text-emerald-400' : 'text-amber-300'}`}>
                {termine ? 'Terminé' : 'En cours'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
