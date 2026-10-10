import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { annulerLot, supprimerCaisses } from '../features/biz/api'
import { CaisseModal } from '../features/biz/CaisseModal'
import { Graph } from '../features/biz/Graph'
import { useCaisses, useRecoltes, useTransformations } from '../features/biz/hooks'
import { LotModal } from '../features/biz/LotModal'
import { usePoints } from '../features/carte/usePoints'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { quantiteTotale } from '../features/stock/mouvements'
import { useArticles } from '../features/stock/useArticles'
import { useTarifs } from '../features/tarifs/useTarifs'
import { GRAINES_PAR_CAISSE, REFERENCE_POCHON, TETES_PAR_POCHON, finLot, pochonsPour } from '../lib/biz'
import { REFERENCE_GRAINE, REFERENCE_TETE, TETES_PAR_PLANT, etatPlan } from '../lib/carte'
import { formatNombre, formatPrix, formatRestant } from '../lib/format'
import { useMaintenant } from '../lib/presence'
import { aAuMoins, aLeDroitAdmin, formatDate, nomAffiche } from '../lib/roles'
import type { Caisse, Transformation } from '../types'

const SEMAINE_MS = 7 * 24 * 3_600_000
const HISTORIQUE_MAX = 20

// `{}` : nouvelle commande ou nouveau lot ; avec l'objet : sa clôture ou sa récupération
type Fenetre = { type: 'caisse'; caisse?: Caisse } | { type: 'lot'; lot?: Transformation }

// Le business du groupe, d'un bout à l'autre : caisses de graines, culture, établi, vente
export function Bizness() {
  const moi = useMembre()
  const caisses = useCaisses()
  const lots = useTransformations()
  const recoltes = useRecoltes()
  const points = usePoints()
  const articles = useArticles()
  const lieux = useLieux()
  const tarifs = useTarifs()
  const membres = useMembres()
  // Toutes les 5 secondes : un petit lot ne dure qu'une minute
  const maintenant = useMaintenant(5_000)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const estGrade = aAuMoins(moi, 'n2')
  const estAdmin = aLeDroitAdmin(moi)
  const [vue, setVue] = useState<'pilotage' | 'graph'>('pilotage')

  const chargement =
    caisses.loading || lots.loading || recoltes.loading || points.loading || articles.loading || lieux.loading
  const erreur =
    caisses.error ?? lots.error ?? recoltes.error ?? points.error ?? articles.error ?? lieux.error ?? tarifs.error

  const agir = (action: Promise<void>) => {
    setErreurAction(null)
    action.catch((e: Error) => setErreurAction(e.message))
  }
  const nomMembre = (uid: string | undefined) => nomAffiche(membres.data.find((m) => m.uid === uid))

  // ---- Où en est chaque étape ----
  const enAttente = caisses.data
    .filter((c) => c.statut === 'commandee')
    .sort((a, b) => (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity))
  const caissesAttendues = enAttente.reduce((total, c) => total + c.quantite, 0)

  const plans = points.data.filter((p) => p.type === 'plan')
  const plants = plans.reduce((total, p) => total + (p.quantite ?? 0), 0)
  const etats = plans.map((p) => etatPlan(p, maintenant).etat)
  const aArroser = etats.filter((e) => e === 'arroser').length
  const prets = etats.filter((e) => e === 'pret').length

  // Un seul lot à la fois : celui qui tourne ou attend d'être récupéré
  const lot = lots.data.find((l) => l.statut === 'en_cours')
  const restantLot = lot ? finLot(lot, maintenant) - maintenant : 0

  const graines = quantiteTotale(articles.data, REFERENCE_GRAINE)
  const tetes = quantiteTotale(articles.data, REFERENCE_TETE)
  const pochons = quantiteTotale(articles.data, REFERENCE_POCHON)

  // ---- Potentiel : ce que chaque étape peut encore donner en pochons ----
  const POCHONS_PAR_GRAINE = TETES_PAR_PLANT / TETES_PAR_POCHON
  const potentiel = [
    { nom: 'Caisses en attente', quantite: caissesAttendues, pochons: caissesAttendues * GRAINES_PAR_CAISSE * POCHONS_PAR_GRAINE },
    { nom: 'Graines en stock', quantite: graines, pochons: graines * POCHONS_PAR_GRAINE },
    { nom: 'Plants en pousse', quantite: plants, pochons: plants * POCHONS_PAR_GRAINE },
    { nom: 'Têtes en stock', quantite: tetes, pochons: tetes / TETES_PAR_POCHON },
    { nom: 'Têtes à l’établi', quantite: lot?.tetes ?? 0, pochons: (lot?.tetes ?? 0) / TETES_PAR_POCHON },
    { nom: 'Pochons en stock', quantite: pochons, pochons },
  ]
  const totalPochons = Math.floor(potentiel.reduce((total, p) => total + p.pochons, 0))
  // Meilleur prix de vente du pochon, toutes grilles des Tarifs confondues
  const ventes = tarifs.data.filter((t) => t.sens === 'vente' && t.reference === REFERENCE_POCHON)
  const meilleur = (prix: (number | null)[]) => Math.max(0, ...prix.map((p) => p ?? 0))
  const prixPropre = meilleur(ventes.map((t) => t.prixPropre))
  const prixSale = meilleur(ventes.map((t) => t.prixSale))

  // ---- Bilan ----
  const closes = caisses.data.filter((c) => c.statut === 'close')
  const recuperes = lots.data.filter((l) => l.statut === 'recupere')
  const bilan = (depuis: number) => {
    const periode = (ts: { toMillis: () => number } | null | undefined) => (ts?.toMillis() ?? maintenant) >= depuis
    const cs = closes.filter((c) => periode(c.closAt))
    const commandees = cs.reduce((total, c) => total + c.quantite, 0)
    const recuperees = cs.reduce((total, c) => total + (c.recuperees ?? 0), 0)
    return {
      commandees,
      recuperees,
      perdues: commandees - recuperees,
      reussite: commandees > 0 ? Math.round((recuperees / commandees) * 100) : null,
      tetes: recoltes.data.filter((r) => periode(r.createdAt)).reduce((total, r) => total + r.tetes, 0),
      pochons: recuperes.filter((l) => periode(l.recupereAt)).reduce((total, l) => total + (l.pochons ?? 0), 0),
    }
  }
  const semaine = bilan(maintenant - SEMAINE_MS)
  const tout = bilan(0)

  // ---- Historique : commandes closes et lots récupérés, du plus récent au plus ancien ----
  const historique = [
    ...closes.map((c) => ({
      id: c.id,
      date: c.closAt,
      texte: `${c.quantite} caisse${c.quantite > 1 ? 's' : ''} : ${c.recuperees ?? 0} récupérée${(c.recuperees ?? 0) > 1 ? 's' : ''}, ${c.quantite - (c.recuperees ?? 0)} perdue${c.quantite - (c.recuperees ?? 0) > 1 ? 's' : ''}`,
      gain: `+${formatNombre((c.recuperees ?? 0) * GRAINES_PAR_CAISSE)} graines`,
      par: c.closParUid,
    })),
    ...recuperes.map((l) => ({
      id: l.id,
      date: l.recupereAt,
      texte: `Lot de ${formatNombre(l.tetes)} têtes à l’établi`,
      gain: `+${formatNombre(l.pochons ?? 0)} pochons`,
      par: l.recupereParUid,
    })),
  ]
    .sort((a, b) => (b.date?.toMillis() ?? Infinity) - (a.date?.toMillis() ?? Infinity))
    .slice(0, HISTORIQUE_MAX)

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Bizne$$</h1>
          <p className="text-sm text-zinc-400">
            Une caisse donne {GRAINES_PAR_CAISSE} graines, un plant {TETES_PAR_PLANT} têtes, {TETES_PAR_POCHON} têtes un
            pochon.
          </p>
        </div>
        {/* Le suivi chiffré est un outil d'admin : les autres membres ne voient pas ces onglets */}
        {estAdmin && (
          <div className="flex rounded-lg border border-zinc-800 p-0.5">
            {(['pilotage', 'graph'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vue === v}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  vue === v ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                onClick={() => setVue(v)}
              >
                {v === 'pilotage' ? 'Pilotage' : 'Graph'}
              </button>
            ))}
          </div>
        )}
      </header>

      <ErrorMessage>{erreur ?? erreurAction}</ErrorMessage>

      {chargement ? (
        <Chargement />
      ) : estAdmin && vue === 'graph' ? (
        <Graph caisses={caisses.data} lots={lots.data} recoltes={recoltes.data} maintenant={maintenant} />
      ) : (
        <>
          {/* La chaîne, étape par étape */}
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Etape numero={1} titre="Caisses" action={<Button onClick={() => setFenetre({ type: 'caisse' })}>Commander</Button>}>
              <Chiffre valeur={caissesAttendues} unite="en attente" alerte={caissesAttendues > 0} />
              {enAttente.length > 0 && (
                <ul className="mt-3 divide-y divide-zinc-800 text-sm">
                  {enAttente.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-zinc-100">
                          {c.quantite} caisse{c.quantite > 1 ? 's' : ''}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {nomMembre(c.creeParUid)} · {formatDate(c.createdAt, true)}
                        </span>
                      </span>
                      {(estGrade || c.creeParUid === moi.uid) && (
                        <button
                          type="button"
                          aria-label="Supprimer la commande"
                          title="Supprimer la commande"
                          className="text-zinc-500 hover:text-red-300"
                          onClick={() =>
                            window.confirm('Supprimer cette commande en attente ?') && agir(supprimerCaisses(c.id))
                          }
                        >
                          ✕
                        </button>
                      )}
                      <Button variant="ghost" className="py-1" onClick={() => setFenetre({ type: 'caisse', caisse: c })}>
                        Clore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Etape>

            <Etape
              numero={2}
              titre="Culture"
              action={
                <Link to="/map" className="text-xs text-zinc-500 hover:text-purple-300">
                  Voir la carte
                </Link>
              }
            >
              <Chiffre valeur={graines} unite="graines en stock" />
              <p className="mt-3 text-sm text-zinc-300">
                {formatNombre(plants)} plant{plants > 1 ? 's' : ''} en terre, sur {plans.length} plan
                {plans.length > 1 ? 's' : ''}
              </p>
              {(aArroser > 0 || prets > 0) && (
                <p className="mt-1 text-sm font-medium">
                  {aArroser > 0 && <span className="text-sky-400">{aArroser} à arroser</span>}
                  {aArroser > 0 && prets > 0 && <span className="text-zinc-600"> · </span>}
                  {prets > 0 && <span className="text-yellow-400">{prets} à récolter</span>}
                </p>
              )}
            </Etape>

            <Etape
              numero={3}
              titre="Établi"
              action={!lot && <Button onClick={() => setFenetre({ type: 'lot' })}>Lancer un lot</Button>}
            >
              <Chiffre valeur={tetes} unite="têtes en stock" />
              {lot ? (
                <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
                  <p className="text-zinc-300">
                    {formatNombre(lot.tetes)} têtes → {formatNombre(pochonsPour(lot.tetes))} pochons
                  </p>
                  {restantLot > 0 ? (
                    <p className="font-semibold text-amber-300">Encore {formatRestant(restantLot)}</p>
                  ) : (
                    <p className="font-semibold text-emerald-400">Terminé</p>
                  )}
                  <div className="flex justify-end gap-2">
                    {restantLot > 0 && (estGrade || lot.lanceParUid === moi.uid) && (
                      <Button
                        variant="danger"
                        className="py-1"
                        onClick={() =>
                          window.confirm('Annuler ce lot ? Ses têtes retournent au stock.') &&
                          agir(annulerLot(lot, articles.data))
                        }
                      >
                        Annuler
                      </Button>
                    )}
                    {restantLot <= 0 && (
                      <Button className="py-1" onClick={() => setFenetre({ type: 'lot', lot })}>
                        Récupérer
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Établi libre.</p>
              )}
            </Etape>

            <Etape
              numero={4}
              titre="Vente"
              action={
                <Link to="/tarifs" className="text-xs text-zinc-500 hover:text-purple-300">
                  Voir les tarifs
                </Link>
              }
            >
              <Chiffre valeur={pochons} unite="pochons en stock" />
              <p className="mt-3 text-sm text-zinc-300">
                {prixPropre > 0 || prixSale > 0 ? (
                  <>
                    Valeur au meilleur tarif :{' '}
                    {prixPropre > 0 && <span className="text-emerald-400">{formatPrix(pochons * prixPropre)}</span>}
                    {prixPropre > 0 && prixSale > 0 && ' ou '}
                    {prixSale > 0 && <span className="text-amber-400">{formatPrix(pochons * prixSale)} sale</span>}
                  </>
                ) : (
                  <span className="text-zinc-500">Aucun prix de vente du pochon dans les Tarifs.</span>
                )}
              </p>
            </Etape>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Card title="Potentiel">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium">Ce qui est engagé</th>
                    <th className="pb-2 text-right font-medium">Quantité</th>
                    <th className="pb-2 text-right font-medium">En pochons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {potentiel.map((p) => (
                    <tr key={p.nom}>
                      <td className="py-1.5 text-zinc-300">{p.nom}</td>
                      <td className="py-1.5 text-right text-zinc-300 tabular-nums">{formatNombre(p.quantite)}</td>
                      <td className="py-1.5 text-right font-medium text-zinc-100 tabular-nums">
                        {formatNombre(Math.floor(p.pochons))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-zinc-700">
                  <tr className="font-semibold">
                    <td colSpan={2} className="pt-2 text-zinc-100">
                      Total possible
                    </td>
                    <td className="pt-2 text-right text-lg text-purple-300 tabular-nums">
                      {formatNombre(totalPochons)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="mt-3 text-sm text-zinc-300">
                {prixPropre > 0 || prixSale > 0 ? (
                  <>
                    Soit, au meilleur prix de vente des Tarifs :{' '}
                    {prixPropre > 0 && (
                      <span className="font-semibold text-emerald-400">{formatPrix(totalPochons * prixPropre)}</span>
                    )}
                    {prixPropre > 0 && prixSale > 0 && ' ou '}
                    {prixSale > 0 && (
                      <span className="font-semibold text-amber-400">{formatPrix(totalPochons * prixSale)} sale</span>
                    )}
                    .
                  </>
                ) : (
                  <span className="text-zinc-500">Ajoute un prix de vente du pochon dans les Tarifs pour le chiffrer.</span>
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                C’est un maximum : les caisses en attente sont comptées comme récupérées.
              </p>
            </Card>

            <Card title="Bilan">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium" />
                    <th className="pb-2 text-right font-medium">7 jours</th>
                    <th className="pb-2 text-right font-medium">Depuis le début</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  <LigneBilan titre="Caisses commandées" a={semaine.commandees} b={tout.commandees} />
                  <LigneBilan titre="Caisses récupérées" a={semaine.recuperees} b={tout.recuperees} />
                  <LigneBilan titre="Caisses perdues" a={semaine.perdues} b={tout.perdues} classe="text-red-300" />
                  <tr>
                    <td className="py-1.5 text-zinc-300">Taux de réussite</td>
                    <td className="py-1.5 text-right font-medium text-zinc-100 tabular-nums">
                      {semaine.reussite === null ? '—' : `${semaine.reussite} %`}
                    </td>
                    <td className="py-1.5 text-right font-medium text-zinc-100 tabular-nums">
                      {tout.reussite === null ? '—' : `${tout.reussite} %`}
                    </td>
                  </tr>
                  <LigneBilan titre="Têtes récoltées" a={semaine.tetes} b={tout.tetes} />
                  <LigneBilan titre="Pochons produits" a={semaine.pochons} b={tout.pochons} classe="text-purple-300" />
                </tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">
                Les caisses comptent à la clôture de leur commande ; les récoltes faites avant l’arrivée de cet onglet
                n’y figurent pas.
              </p>
            </Card>
          </div>

          <Card title="Historique">
            {historique.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune commande close ni lot récupéré pour le moment.</p>
            ) : (
              <ul className="divide-y divide-zinc-800 text-sm">
                {historique.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                    <span className="w-28 shrink-0 text-zinc-500 tabular-nums">{formatDate(h.date, true)}</span>
                    <span className="min-w-0 flex-1 text-zinc-300">{h.texte}</span>
                    <span className="font-medium text-emerald-400 tabular-nums">{h.gain}</span>
                    <span className="w-32 truncate text-right text-zinc-500">{nomMembre(h.par)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {fenetre?.type === 'caisse' && (
        <CaisseModal
          caisse={fenetre.caisse}
          lieux={lieux.data}
          articles={articles.data}
          acteurUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'lot' && (
        <LotModal
          lot={fenetre.lot}
          lieux={lieux.data}
          articles={articles.data}
          acteurUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}

function Etape({
  numero,
  titre,
  action,
  children,
}: {
  numero: number
  titre: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="p-4!">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <span className="flex size-6 items-center justify-center rounded-full bg-purple-800 text-sm text-white">
            {numero}
          </span>
          {titre}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Chiffre({ valeur, unite, alerte = false }: { valeur: number; unite: string; alerte?: boolean }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className={`text-3xl font-semibold tabular-nums ${alerte ? 'text-amber-300' : 'text-zinc-50'}`}>
        {formatNombre(valeur)}
      </span>
      <span className="text-sm text-zinc-400">{unite}</span>
    </p>
  )
}

function LigneBilan({ titre, a, b, classe = 'text-zinc-100' }: { titre: string; a: number; b: number; classe?: string }) {
  return (
    <tr>
      <td className="py-1.5 text-zinc-300">{titre}</td>
      <td className={`py-1.5 text-right font-medium tabular-nums ${classe}`}>{formatNombre(a)}</td>
      <td className={`py-1.5 text-right font-medium tabular-nums ${classe}`}>{formatNombre(b)}</td>
    </tr>
  )
}
