import { useEffect, useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { Button, Card, Chargement, ErrorMessage, inputClass } from '../components/ui'
import {
  GENRE_LABELS,
  PROPRIETAIRE_NOUS,
  annulerBlanchiment,
  formatDuree,
  genreCommerce,
  nomCommerce,
  propreAttendu,
} from '../features/blanchiment/api'
import { CommerceModal } from '../features/blanchiment/CommerceModal'
import { LancementModal } from '../features/blanchiment/LancementModal'
import { RecuperationModal } from '../features/blanchiment/RecuperationModal'
import { useBlanchiments } from '../features/blanchiment/useBlanchiments'
import { useCommerces } from '../features/blanchiment/useCommerces'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { useArticles } from '../features/stock/useArticles'
import { comparerPartenaires } from '../features/tarifs/api'
import { TuileCouleur } from '../features/tarifs/TuileCouleur'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { formatPrix } from '../lib/format'
import { aAuMoins, formatDate, nomAffiche } from '../lib/roles'
import type { Blanchiment as Depot, CommerceVille, GenreCommerce } from '../types'

type Fenetre =
  | { type: 'commerce'; commerce?: CommerceVille }
  | { type: 'lancement'; commerce: CommerceVille }
  | { type: 'recuperation'; depot: Depot }
  | { type: 'historique' }

const HISTORIQUE_MAX = 50

// Heure courante, rafraîchie toutes les 15 secondes : le temps restant d'un dépôt avance sans recharger la page
function useHorloge(): number {
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  return maintenant
}

const GENRE_CLASSES: Record<GenreCommerce, string> = {
  standard: 'text-zinc-400',
  securise: 'text-emerald-400',
  express: 'text-sky-400',
}

// Standard, Sécurisé ou Express
function GenreBadge({ commerce }: { commerce: CommerceVille }) {
  const genre = genreCommerce(commerce)
  return <span className={`font-medium ${GENRE_CLASSES[genre]}`}>{GENRE_LABELS[genre]}</span>
}

const heure = (millis: number) => new Date(millis).toLocaleTimeString('fr-FR', { timeStyle: 'short' })

export function Blanchiment() {
  const moi = useMembre()
  const commerces = useCommerces()
  const depots = useBlanchiments()
  const partenaires = usePartenaires()
  const lieux = useLieux()
  const articles = useArticles()
  const membres = useMembres()
  const maintenant = useHorloge()
  const [recherche, setRecherche] = useState('')
  // Tri du tableau des autres commerces par zip ; null : rangés par groupe
  const [triZip, setTriZip] = useState<'asc' | 'desc' | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const estGrade = aAuMoins(moi, 'n2')
  const chargement = commerces.loading || depots.loading || partenaires.loading || lieux.loading || articles.loading

  const parZip = (a: CommerceVille, b: CommerceVille) => a.zip.localeCompare(b.zip, 'fr', { numeric: true })
  const proprietaire = (commerce: CommerceVille) => partenaires.data.find((p) => p.id === commerce.proprietaireId)
  const depotEnCours = (commerce: CommerceVille) =>
    depots.data.find((d) => d.commerceId === commerce.id && d.statut === 'en_cours')
  const nomMembre = (uid: string | undefined) => nomAffiche(membres.data.find((m) => m.uid === uid))

  const nos = commerces.data.filter((c) => c.proprietaireId === PROPRIETAIRE_NOUS).sort(parZip)

  const terme = recherche.trim().toLocaleLowerCase('fr')
  const autres = commerces.data
    .filter((c) => c.proprietaireId !== PROPRIETAIRE_NOUS)
    .map((commerce) => ({ commerce, groupe: proprietaire(commerce) }))
    .filter(({ commerce: c, groupe }) =>
      `${c.zip} ${c.nom} ${c.description} ${groupe?.nom ?? 'inconnu'}`.toLocaleLowerCase('fr').includes(terme),
    )
    // Par zip si la colonne est triée. Sinon par groupe (Cartel d'abord, puis alphabétique), les propriétaires
    // inconnus à la fin ; puis par zip.
    .sort((a, b) => {
      if (triZip) return triZip === 'asc' ? parZip(a.commerce, b.commerce) : parZip(b.commerce, a.commerce)
      if (a.groupe && b.groupe) return comparerPartenaires(a.groupe, b.groupe) || parZip(a.commerce, b.commerce)
      if (a.groupe || b.groupe) return a.groupe ? -1 : 1
      return parZip(a.commerce, b.commerce)
    })

  const historique = depots.data
    .filter((d) => d.statut === 'recupere')
    .sort((a, b) => (b.recupereAt?.toMillis() ?? Infinity) - (a.recupereAt?.toMillis() ?? Infinity))
    .slice(0, HISTORIQUE_MAX)

  function annuler(depot: Depot) {
    const retour = depot.lieuId ? ' Les billets retourneront dans le stock.' : ''
    if (!window.confirm(`Annuler le blanchiment de ${formatPrix(depot.montant)} dans ${depot.commerceNom} ?${retour}`)) return
    setErreurAction(null)
    annulerBlanchiment(depot, articles.data).catch((e: Error) => setErreurAction(e.message))
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Blanchiment</h1>
          <p className="text-sm text-zinc-400">
            Commerces recensés en ville, par zip, et argent sale en cours de blanchiment dans les nôtres.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setFenetre({ type: 'historique' })}>
            Historique
          </Button>
          {estGrade && <Button onClick={() => setFenetre({ type: 'commerce' })}>+ Commerce</Button>}
        </div>
      </header>

      <ErrorMessage>
        {commerces.error ?? depots.error ?? partenaires.error ?? lieux.error ?? articles.error ?? erreurAction}
      </ErrorMessage>

      {chargement ? (
        <Chargement />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">Nos commerces</h2>
            {nos.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aucun commerce à nous pour le moment.
                {estGrade && ' Recense-le avec « + Commerce » en choisissant « À nous » comme appartenance.'}
              </p>
            ) : (
              <div className="grid items-start gap-6 lg:grid-cols-2">
                {nos.map((commerce) => {
                  const depot = depotEnCours(commerce)
                  const fin = depot?.fin.toMillis() ?? 0
                  const pret = depot !== undefined && maintenant >= fin
                  const avancement = depot
                    ? Math.min(1, (maintenant - depot.debut.toMillis()) / Math.max(1, fin - depot.debut.toMillis()))
                    : 0
                  return (
                    <Card
                      key={commerce.id}
                      className={pret ? 'border-l-emerald-500!' : undefined}
                      title={nomCommerce(commerce)}
                      action={
                        estGrade && (
                          <button
                            type="button"
                            className="text-xs text-zinc-500 hover:text-purple-300"
                            onClick={() => setFenetre({ type: 'commerce', commerce })}
                          >
                            Modifier
                          </button>
                        )
                      }
                    >
                      <p className="-mt-2 text-sm text-zinc-400">
                        Zip <span className="font-semibold text-zinc-100 tabular-nums">{commerce.zip}</span>
                        {' · '}
                        <GenreBadge commerce={commerce} />
                        {commerce.taux !== null && <> · taux {commerce.taux} %</>}
                        {commerce.dureeMinutes !== null && <> · {formatDuree(commerce.dureeMinutes)}</>}
                        {commerce.montantMax != null && <> · max {formatPrix(commerce.montantMax)}</>}
                      </p>
                      {commerce.description && <p className="text-sm text-zinc-400">{commerce.description}</p>}
                      {commerce.note && <p className="text-xs text-zinc-500">{commerce.note}</p>}

                      <div className="mt-4">
                        {!depot ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-zinc-500">Rien à blanchir en cours.</p>
                            {estGrade && (
                              <Button onClick={() => setFenetre({ type: 'lancement', commerce })}>
                                Lancer un blanchiment
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className={`text-sm font-semibold ${pret ? 'text-emerald-400' : 'text-amber-300'}`}>
                                {pret ? 'Prêt à récupérer' : 'Blanchiment en cours'}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {pret
                                  ? `terminé à ${heure(fin)}`
                                  : `reste ${formatDuree(Math.ceil((fin - maintenant) / 60_000))} · fin à ${heure(fin)}`}
                              </p>
                            </div>
                            <div
                              role="progressbar"
                              aria-label="Avancement du blanchiment"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(avancement * 100)}
                              className="h-2 overflow-hidden rounded-full bg-zinc-800"
                            >
                              <div
                                className={`h-full rounded-full ${pret ? 'bg-emerald-500' : 'bg-purple-600'}`}
                                style={{ width: `${avancement * 100}%` }}
                              />
                            </div>
                            <p className="text-sm text-zinc-300">
                              <span className="font-semibold text-amber-400 tabular-nums">{formatPrix(depot.montant)}</span>{' '}
                              de sale à {depot.taux} % →{' '}
                              <span className="font-semibold text-emerald-400 tabular-nums">
                                {formatPrix(propreAttendu(depot.montant, depot.taux))}
                              </span>{' '}
                              de propre
                            </p>
                            <p className="text-xs text-zinc-500">
                              Lancé le {formatDate(depot.debut, true)} par {nomMembre(depot.lanceParUid)}
                            </p>
                            {estGrade && (
                              <div className="flex justify-end gap-2 pt-1">
                                <Button variant="danger" onClick={() => annuler(depot)}>
                                  Annuler
                                </Button>
                                {pret && (
                                  <Button onClick={() => setFenetre({ type: 'recuperation', depot })}>Récupérer</Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <Card title="Autres commerces">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  className={`${inputClass} max-w-xs`}
                  placeholder="Zip, nom, groupe"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
                <span className="ml-auto text-sm text-zinc-500">
                  {autres.length} commerce{autres.length > 1 ? 's' : ''}
                </span>
              </div>
              {autres.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {terme ? 'Aucun commerce ne correspond.' : 'Aucun autre commerce recensé pour le moment.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs tracking-wide text-zinc-500 uppercase">
                      <tr>
                        <th className="pb-2 font-medium">Groupe</th>
                        <th
                          className="pb-2 font-medium"
                          aria-sort={triZip === 'asc' ? 'ascending' : triZip === 'desc' ? 'descending' : 'none'}
                        >
                          {/* Un clic : croissant ; deux : décroissant ; trois : retour au rangement par groupe */}
                          <button
                            type="button"
                            title={
                              triZip === 'asc'
                                ? 'Zip croissant — cliquer pour décroissant'
                                : triZip === 'desc'
                                  ? 'Zip décroissant — cliquer pour ranger par groupe'
                                  : 'Trier par zip'
                            }
                            className={`tracking-wide uppercase hover:text-purple-300 ${triZip ? 'text-purple-300' : ''}`}
                            onClick={() => setTriZip(triZip === null ? 'asc' : triZip === 'asc' ? 'desc' : null)}
                          >
                            Zip {triZip === 'asc' ? '▲' : triZip === 'desc' ? '▼' : '↕'}
                          </button>
                        </th>
                        <th className="pb-2 font-medium">Commerce</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 text-right font-medium">Taux</th>
                        <th className="pb-2 pl-4 text-right font-medium">Durée</th>
                        <th className="pb-2 pl-4 text-right font-medium">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {autres.map(({ commerce, groupe }) => (
                        <tr
                          key={commerce.id}
                          className={estGrade ? 'cursor-pointer align-top hover:bg-zinc-800/50' : 'align-top'}
                          onClick={estGrade ? () => setFenetre({ type: 'commerce', commerce }) : undefined}
                        >
                          <td className="py-2.5 pr-4">
                            {groupe ? (
                              <span className="flex items-center gap-2 whitespace-nowrap text-zinc-100">
                                <TuileCouleur partenaire={groupe} className="size-4" />
                                {groupe.nom}
                              </span>
                            ) : (
                              <span className="text-zinc-500">Inconnu</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 font-semibold text-zinc-100 tabular-nums">{commerce.zip}</td>
                          <td className="py-2.5 pr-4">
                            <p className="text-zinc-100">{commerce.nom || '—'}</p>
                            {commerce.description && <p className="text-xs text-zinc-500">{commerce.description}</p>}
                            {commerce.note && <p className="text-xs text-zinc-500">{commerce.note}</p>}
                          </td>
                          <td className="py-2.5 pr-4">
                            <GenreBadge commerce={commerce} />
                          </td>
                          <td className="py-2.5 text-right text-zinc-300 tabular-nums">
                            {commerce.taux === null ? '—' : `${commerce.taux} %`}
                          </td>
                          <td className="py-2.5 pl-4 text-right whitespace-nowrap text-zinc-300">
                            {commerce.dureeMinutes === null ? '—' : formatDuree(commerce.dureeMinutes)}
                          </td>
                          <td className="py-2.5 pl-4 text-right whitespace-nowrap text-zinc-300 tabular-nums">
                            {formatPrix(commerce.montantMax)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {fenetre?.type === 'commerce' && (
        <CommerceModal
          commerce={fenetre.commerce}
          partenaires={partenaires.data}
          occupe={fenetre.commerce ? depotEnCours(fenetre.commerce) !== undefined : false}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'lancement' && (
        <LancementModal
          commerce={fenetre.commerce}
          lieux={lieux.data}
          articles={articles.data}
          acteurUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'recuperation' && (
        <RecuperationModal blanchiment={fenetre.depot} acteurUid={moi.uid} onClose={() => setFenetre(null)} />
      )}
      {fenetre?.type === 'historique' && (
        <Modal title="Historique des blanchiments" onClose={() => setFenetre(null)}>
          {historique.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucun blanchiment récupéré pour le moment.</p>
          ) : (
            <ul className="max-h-[60svh] divide-y divide-zinc-800 overflow-y-auto pr-1 text-sm">
              {historique.map((depot) => (
                <li key={depot.id} className="py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-zinc-100">{depot.commerceNom}</span>
                    <span className="text-xs text-zinc-500">{formatDate(depot.recupereAt, true)}</span>
                  </div>
                  <p className="text-zinc-300">
                    <span className="text-amber-400 tabular-nums">{formatPrix(depot.montant)}</span> de sale à {depot.taux} % →{' '}
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      {formatPrix(depot.montantRecupere)}
                    </span>{' '}
                    récupérés
                  </p>
                  <p className="text-xs text-zinc-500">Récupéré par {nomMembre(depot.recupereParUid)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setFenetre(null)}>
              Fermer
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
