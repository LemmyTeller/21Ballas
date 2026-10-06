import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageItem } from '../components/ImageItem'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { renommerEvent, retirerItem, viderEvent } from '../features/event/api'
import { ItemEventModal } from '../features/event/ItemEventModal'
import { useEvent } from '../features/event/useEvent'
import { useArticles } from '../features/stock/useArticles'
import { formatNombre } from '../lib/format'
import { aAuMoins } from '../lib/roles'
import { useReferences } from '../lib/useCatalogue'

// `{}` : ajout d'un item ; `{ cle }` : changement des points d'un item déjà dans l'event
type Fenetre = { cle?: string }

// Course au produit : chaque item de l'event rapporte des points par unité possédée. Les quantités viennent du Stock,
// tous lieux confondus : le score suit le stock tout seul.
export function Event() {
  const moi = useMembre()
  const event = useEvent()
  const articles = useArticles()
  const catalogue = useReferences()
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const estGrade = aAuMoins(moi, 'n2')

  const chargement = event.loading || articles.loading || !catalogue.items

  const lignes = Object.entries(event.data.points)
    .map(([cle, points]) => {
      const reference = catalogue.items?.find((r) => r.cle === cle)
      const article = articles.data.find((a) => a.id === cle)
      const quantite = Object.values(article?.quantites ?? {}).reduce((total, q) => total + Math.max(0, q), 0)
      return { cle, reference, nom: reference?.name ?? `Item ${cle}`, points, quantite, score: quantite * points }
    })
    .sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr'))
  const total = lignes.reduce((somme, l) => somme + l.score, 0)

  const agir = (action: Promise<void>) => {
    setErreurAction(null)
    action.catch((e: Error) => setErreurAction(e.message))
  }

  function renommer() {
    const nom = window.prompt('Nom de l’event', event.data.nom)
    if (nom !== null) agir(renommerEvent(nom.slice(0, 60)))
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">{event.data.nom || 'Event'}</h1>
          <p className="text-sm text-zinc-400">
            Course au produit : chaque item rapporte ses points par unité en stock, tous lieux confondus.
          </p>
        </div>
        {estGrade && !chargement && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={renommer}>
              Renommer
            </Button>
            {lignes.length > 0 && (
              <Button
                variant="danger"
                onClick={() =>
                  window.confirm('Vider l’event ? Son nom, ses items et leurs points sont effacés. Le Stock n’est pas touché.') &&
                  agir(viderEvent())
                }
              >
                Vider l’event
              </Button>
            )}
            <Button onClick={() => setFenetre({})}>+ Item</Button>
          </div>
        )}
      </header>

      <ErrorMessage>{event.error ?? articles.error ?? catalogue.erreur ?? erreurAction}</ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : (
        <>
          <Card className="p-4!">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Score total</p>
            <p className="mt-1 text-4xl font-semibold text-purple-300 tabular-nums">
              {formatNombre(total)} <span className="text-lg font-medium text-zinc-400">points</span>
            </p>
          </Card>

          <Card>
            {lignes.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {estGrade
                  ? 'Aucun item dans l’event. Ajoute le premier avec « + Item ».'
                  : 'Aucun item dans l’event pour le moment.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="pb-2 font-medium" colSpan={2}>
                        Item
                      </th>
                      <th className="pb-2 text-right font-medium">En stock</th>
                      <th className="pb-2 text-right font-medium">Points / unité</th>
                      <th className="pb-2 text-right font-medium">Score</th>
                      {estGrade && <th />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {lignes.map((l) => (
                      <tr key={l.cle}>
                        <td className="w-12 py-2 pr-3">
                          <ImageItem item={l.reference} dossier={l.reference?.dossier} />
                        </td>
                        <td className="py-2 pr-4 font-medium text-zinc-100">{l.nom}</td>
                        <td className="py-2 pr-4 text-right text-zinc-300 tabular-nums">{formatNombre(l.quantite)}</td>
                        <td className="py-2 pr-4 text-right text-zinc-300 tabular-nums">{formatNombre(l.points)}</td>
                        <td className="py-2 pr-4 text-right text-base font-semibold text-zinc-50 tabular-nums">
                          {formatNombre(l.score)}
                        </td>
                        {estGrade && (
                          <td className="py-2 text-right whitespace-nowrap">
                            <Button variant="ghost" className="py-1" onClick={() => setFenetre({ cle: l.cle })}>
                              Points
                            </Button>
                            <Button
                              variant="danger"
                              className="ml-2 py-1"
                              onClick={() =>
                                window.confirm(`Retirer ${l.nom} de l’event ?`) && agir(retirerItem(l.cle))
                              }
                            >
                              Retirer
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {fenetre && (
        <ItemEventModal
          catalogue={(catalogue.items ?? []).filter((r) => !(r.cle in event.data.points))}
          item={fenetre.cle ? { cle: fenetre.cle, nom: lignes.find((l) => l.cle === fenetre.cle)?.nom ?? '' } : undefined}
          pointsActuels={fenetre.cle ? event.data.points[fenetre.cle] : undefined}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}
