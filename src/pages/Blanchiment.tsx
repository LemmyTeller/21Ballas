import { useState } from 'react'
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
import { CompteModal, type ActionCompte } from '../features/blanchiment/CompteModal'
import { RecuperationModal } from '../features/blanchiment/RecuperationModal'
import { useBlanchiments } from '../features/blanchiment/useBlanchiments'
import { useCommerces } from '../features/blanchiment/useCommerces'
import { useComptes, useOperations } from '../features/blanchiment/useComptes'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { useArticles } from '../features/stock/useArticles'
import { comparerPartenaires } from '../features/tarifs/api'
import { TuileCouleur } from '../features/tarifs/TuileCouleur'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { estimerCompte } from '../lib/blanchiment'
import { formatPrix } from '../lib/format'
import { useMaintenant } from '../lib/presence'
import { aAuMoins, formatDate, nomAffiche } from '../lib/roles'
import type { Blanchiment as Depot, CommerceVille, GenreCommerce } from '../types'

type Fenetre =
  | { type: 'commerce'; commerce?: CommerceVille }
  | { type: 'compte'; commerce: CommerceVille; action: ActionCompte }
  | { type: 'recuperation'; depot: Depot }
  | { type: 'historique' }

const HISTORIQUE_MAX = 50

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
  const comptes = useComptes()
  const operations = useOperations()
  // Toutes les 15 secondes : sale et propre avancent sans recharger la page
  const maintenant = useMaintenant(15_000)
  const [recherche, setRecherche] = useState('')
  // Tri du tableau des autres commerces par zip ; null : rangés par groupe
  const [triZip, setTriZip] = useState<'asc' | 'desc' | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const estGrade = aAuMoins(moi, 'n2')
  const chargement =
    commerces.loading ||
    depots.loading ||
    comptes.loading ||
    partenaires.loading ||
    lieux.loading ||
    articles.loading

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

  // Journal du nouveau fonctionnement : ajouts, retraits et relevés, du plus récent au plus ancien
  const journal = [...operations.data]
    .sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity))
    .slice(0, HISTORIQUE_MAX)
  const totalDe = (type: 'depot' | 'retrait') =>
    operations.data.filter((op) => op.type === type).reduce((total, op) => total + (op.montant ?? 0), 0)
  const totalDepose = totalDe('depot')
  const totalRetire = totalDe('retrait')

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
            Commerces recensés en ville, par zip. Les nôtres blanchissent en continu : on y ajoute du sale et on en
            retire le propre à tout moment.
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
        {commerces.error ??
          depots.error ??
          comptes.error ??
          operations.error ??
          partenaires.error ??
          lieux.error ??
          articles.error ??
          erreurAction}
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
                  const compte = comptes.data.find((c) => c.id === commerce.id)
                  const etat = estimerCompte(compte, commerce, maintenant)
                  const depot = depotEnCours(commerce)
                  const fin = depot?.fin.toMillis() ?? 0
                  const pret = depot !== undefined && maintenant >= fin
                  const avancement = depot
                    ? Math.min(1, (maintenant - depot.debut.toMillis()) / Math.max(1, fin - depot.debut.toMillis()))
                    : 0
                  return (
                    <Card
                      key={commerce.id}
                      className={etat.propre > 0 ? 'border-l-emerald-500!' : undefined}
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

                      {/* Le compte du commerce : il blanchit en continu, comme en jeu */}
                      <div className="mt-4 space-y-2">
                        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <span className="text-sm text-zinc-400">
                            Sale{' '}
                            <span className="text-xl font-semibold text-amber-400 tabular-nums">
                              {formatPrix(etat.sale)}
                            </span>
                            {commerce.montantMax != null && (
                              <span className="tabular-nums"> / {formatPrix(commerce.montantMax)}</span>
                            )}
                          </span>
                          <span className="text-sm text-zinc-400">
                            Propre{' '}
                            <span className="text-xl font-semibold text-emerald-400 tabular-nums">
                              {formatPrix(etat.propre)}
                            </span>
                          </span>
                        </p>
                        {etat.libre !== null && commerce.montantMax ? (
                          <>
                            {/* Jauge du plafond : sale en attente, puis part déjà blanchie non retirée, puis place libre */}
                            <div
                              role="img"
                              aria-label={`Plafond occupé à ${Math.round((1 - etat.libre / commerce.montantMax) * 100)} %`}
                              className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-zinc-800"
                            >
                              <div className="h-full bg-amber-500" style={{ width: `${(etat.sale / commerce.montantMax) * 100}%` }} />
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${Math.max(0, 1 - (etat.sale + etat.libre) / commerce.montantMax) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="flex flex-wrap justify-between gap-x-4 text-sm">
                              <span className={etat.sale > 0 ? 'text-zinc-300' : 'font-semibold text-red-400'}>
                                {etat.sale > 0
                                  ? `Vide dans ${formatDuree(Math.ceil(etat.minutesAvantVide ?? 0))}`
                                  : 'À recharger : plus de sale à blanchir'}
                              </span>
                              <span className="text-zinc-400">Place libre {formatPrix(etat.libre)}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-amber-300">
                            Renseigne le taux, la durée et le plafond sur la fiche pour que l’appli estime le blanchiment.
                          </p>
                        )}
                        <p className="text-xs text-zinc-500">
                          {compte?.releveAt
                            ? `${etat.estimable ? 'Estimé à partir du' : 'Dernier'} relevé du ${formatDate(compte.releveAt, true)}`
                            : 'Aucun relevé pour le moment : saisis les chiffres du jeu avec « Relevé ».'}
                        </p>
                        {estGrade && (
                          <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setFenetre({ type: 'compte', commerce, action: 'releve' })}>
                              Relevé
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={etat.propre <= 0}
                              onClick={() => setFenetre({ type: 'compte', commerce, action: 'retrait' })}
                            >
                              Retirer du propre
                            </Button>
                            <Button onClick={() => setFenetre({ type: 'compte', commerce, action: 'depot' })}>
                              Ajouter du sale
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Ancien dépôt encore ouvert : il se clôt comme avant, puis ce bloc disparaît */}
                      {depot && (
                        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                          <p className="mb-2 text-xs tracking-wide text-zinc-500 uppercase">Ancien dépôt</p>
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
                        </div>
                      )}
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
          occupe={
            fenetre.commerce
              ? depotEnCours(fenetre.commerce) !== undefined ||
                comptes.data.some((c) => c.id === fenetre.commerce?.id && (c.sale > 0 || c.propre > 0))
              : false
          }
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'compte' && (
        <CompteModal
          action={fenetre.action}
          commerce={fenetre.commerce}
          estimation={estimerCompte(
            comptes.data.find((c) => c.id === fenetre.commerce.id),
            fenetre.commerce,
            maintenant,
          )}
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
          <p className="text-sm text-zinc-300">
            Sale déposé{' '}
            <span className="font-semibold text-amber-400 tabular-nums">{formatPrix(totalDepose)}</span> · propre retiré{' '}
            <span className="font-semibold text-emerald-400 tabular-nums">{formatPrix(totalRetire)}</span>
          </p>
          {journal.length === 0 && historique.length === 0 && (
            <p className="text-sm text-zinc-500">Aucune opération pour le moment.</p>
          )}
          <div className="max-h-[60svh] space-y-4 overflow-y-auto pr-1">
            {journal.length > 0 && (
              <ul className="divide-y divide-zinc-800 text-sm">
                {journal.map((op) => (
                  <li key={op.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-zinc-100">{op.commerceNom}</span>
                      <span className="text-xs text-zinc-500">{formatDate(op.createdAt, true)}</span>
                    </div>
                    <p className="text-zinc-300">
                      {op.type === 'depot' && (
                        <>
                          Ajout de <span className="font-semibold text-amber-400 tabular-nums">{formatPrix(op.montant)}</span>{' '}
                          de sale
                        </>
                      )}
                      {op.type === 'retrait' && (
                        <>
                          Retrait de{' '}
                          <span className="font-semibold text-emerald-400 tabular-nums">{formatPrix(op.montant)}</span> de
                          propre
                        </>
                      )}
                      {op.type === 'releve' && 'Relevé'}
                      <span className="text-zinc-500">
                        {' '}
                        → sale {formatPrix(op.sale)}, propre {formatPrix(op.propre)}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500">Par {nomMembre(op.parUid)}</p>
                  </li>
                ))}
              </ul>
            )}
            {historique.length > 0 && <p className="text-xs tracking-wide text-zinc-500 uppercase">Anciens dépôts</p>}
          </div>
          {historique.length > 0 && (
            <ul className="max-h-[30svh] divide-y divide-zinc-800 overflow-y-auto pr-1 text-sm">
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
