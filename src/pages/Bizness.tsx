import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMembre } from '../auth/AuthContext'
import { EntreesSorties } from '../components/EntreesSorties'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { annulerLot } from '../features/biz/api'
import { useMouvements, useTransformations, useZone } from '../features/biz/hooks'
import { LotModal } from '../features/biz/LotModal'
import { ZoneModal, type ActionZone } from '../features/biz/ZoneModal'
import { usePoints } from '../features/carte/usePoints'
import { useLieux } from '../features/gestion/useLieux'
import { quantiteTotale } from '../features/stock/mouvements'
import { useArticles } from '../features/stock/useArticles'
import { REFERENCE_POCHON, TETES_MAX, TETES_PAR_POCHON, estimerZone, finLot, pochonsPour, zoneExacte } from '../lib/biz'
import { REFERENCE_GRAINE, REFERENCE_TETE, TETES_PAR_PLANT, etatPlan } from '../lib/carte'
import { formatNombre, formatRestant } from '../lib/format'
import { jourDeSaisie } from '../lib/journee'
import { useMaintenant } from '../lib/presence'
import { peutGererLeGroupe } from '../lib/roles'
import type { Transformation } from '../types'

const JOUR_MS = 24 * 3_600_000
// Journées affichées dans les graphiques
const JOURS = 14

type Fenetre = { type: 'zone'; action: ActionZone } | { type: 'lot'; lot: Transformation }

const SUIVIS = [
  { reference: REFERENCE_GRAINE, titre: 'Graines de weed' },
  { reference: REFERENCE_TETE, titre: 'Têtes de weed' },
  { reference: REFERENCE_POCHON, titre: 'Pochons de weed' },
]

// Le business du groupe : la culture, la zone de transformation (têtes → pochons, stock des go-fast),
// et les entrées et sorties de stock jour par jour
export function Bizness() {
  const moi = useMembre()
  const zone = useZone()
  const mouvements = useMouvements()
  const lots = useTransformations()
  const points = usePoints()
  const articles = useArticles()
  const lieux = useLieux()
  // Toutes les 5 secondes : la zone sort un pochon toutes les 9 secondes
  const maintenant = useMaintenant(5_000)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const peutAgir = peutGererLeGroupe(moi)

  const chargement = zone.loading || mouvements.loading || lots.loading || points.loading || articles.loading || lieux.loading
  const erreur = zone.error ?? mouvements.error ?? lots.error ?? points.error ?? articles.error ?? lieux.error

  // ---- Culture ----
  const plans = points.data.filter((p) => p.type === 'plan')
  const plants = plans.reduce((total, p) => total + (p.quantite ?? 0), 0)
  const etats = plans.map((p) => etatPlan(p, maintenant).etat)
  const aArroser = etats.filter((e) => e === 'arroser').length
  const prets = etats.filter((e) => e === 'pret').length
  const graines = quantiteTotale(articles.data, REFERENCE_GRAINE)
  const tetes = quantiteTotale(articles.data, REFERENCE_TETE)
  const pochons = quantiteTotale(articles.data, REFERENCE_POCHON)

  // ---- Zone de transformation ----
  const etat = estimerZone(zone.data, maintenant)

  // Ancien lot à l'établi encore ouvert : il se clôt comme avant, puis le bloc disparaît
  const ancienLot = lots.data.find((l) => l.statut === 'en_cours')
  const restantLot = ancienLot ? finLot(ancienLot, maintenant) - maintenant : 0

  // ---- Entrées et sorties par journée de jeu (de 3 h à 3 h) ----
  const jours = Array.from({ length: JOURS }, (_, i) => jourDeSaisie(maintenant - (JOURS - 1 - i) * JOUR_MS))
  const etiquettes = jours.map((j) => `${j.slice(8, 10)}/${j.slice(5, 7)}`)
  const flux = (reference: string) => {
    const entrees = new Map<string, number>()
    const sorties = new Map<string, number>()
    for (const m of mouvements.data) {
      if (m.reference !== reference || !m.createdAt) continue
      const jour = jourDeSaisie(m.createdAt.toMillis())
      const cible = m.delta > 0 ? entrees : sorties
      cible.set(jour, (cible.get(jour) ?? 0) + Math.abs(m.delta))
    }
    return { entrees: jours.map((j) => entrees.get(j) ?? 0), sorties: jours.map((j) => sorties.get(j) ?? 0) }
  }

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Bizne$$</h1>
        <p className="text-sm text-zinc-400">
          Un plant donne {TETES_PAR_PLANT} têtes, {TETES_PAR_POCHON} têtes font un pochon.
        </p>
      </header>

      <ErrorMessage>{erreur ?? erreurAction}</ErrorMessage>

      {chargement ? (
        <Chargement />
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card
              className="p-4!"
              title="Culture"
              action={
                <Link to="/map" className="text-xs text-zinc-500 hover:text-purple-300">
                  Voir la carte
                </Link>
              }
            >
              <ul className="space-y-1.5 text-sm">
                <Ligne valeur={graines} unite="graines en stock" />
                <Ligne valeur={plants} unite={`plants en terre, sur ${plans.length} plan${plans.length > 1 ? 's' : ''}`} />
                <Ligne valeur={tetes} unite="têtes en stock" />
                <Ligne valeur={pochons} unite="pochons en stock" />
              </ul>
              {(aArroser > 0 || prets > 0) && (
                <p className="mt-3 text-sm font-medium">
                  {aArroser > 0 && <span className="text-sky-400">{aArroser} à arroser</span>}
                  {aArroser > 0 && prets > 0 && <span className="text-zinc-600"> · </span>}
                  {prets > 0 && <span className="text-yellow-400">{prets} à récolter</span>}
                </p>
              )}
            </Card>

            <Card className="p-4!" title="Zone de transformation">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p className="text-sm text-zinc-400">
                  Têtes{' '}
                  <span className="text-2xl font-semibold text-zinc-50 tabular-nums">{formatNombre(etat.tetes)}</span>
                  <span className="tabular-nums"> / {formatNombre(TETES_MAX)}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  Pochons disponibles{' '}
                  <span className="text-2xl font-semibold text-emerald-400 tabular-nums">{formatNombre(etat.pochons)}</span>
                </p>
              </div>
              {/* Jauge de la zone : têtes encore à transformer sur sa capacité */}
              <div
                role="img"
                aria-label={`Zone remplie à ${Math.round((etat.tetes / TETES_MAX) * 100)} %`}
                className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"
              >
                <div
                  className="h-full rounded-full bg-purple-600"
                  style={{ width: `${Math.min(1, etat.tetes / TETES_MAX) * 100}%` }}
                />
              </div>
              <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm">
                <span className={etat.tetes > 0 ? 'text-amber-300' : 'text-zinc-500'}>
                  {etat.tetes > 0
                    ? `Tout transformé dans ${formatRestant(etat.secondesRestantes * 1000)}`
                    : 'Plus rien à transformer'}
                </span>
                <span className="text-zinc-400">Place libre {formatNombre(etat.libre)} têtes</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                La zone sert aussi de stockage : on y range et on y prend des pochons pour les go-fast.
                {!zone.data && ' Aucun relevé pour le moment : dépose des têtes ou saisis les chiffres du jeu.'}
              </p>
              {peutAgir && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setFenetre({ type: 'zone', action: 'releve' })}>
                    Relevé
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={etat.pochons <= 0}
                    onClick={() => setFenetre({ type: 'zone', action: 'retrait' })}
                  >
                    Retirer des pochons
                  </Button>
                  <Button variant="ghost" onClick={() => setFenetre({ type: 'zone', action: 'depotPochons' })}>
                    Déposer des pochons
                  </Button>
                  <Button disabled={etat.libre <= 0} onClick={() => setFenetre({ type: 'zone', action: 'depot' })}>
                    Déposer des têtes
                  </Button>
                </div>
              )}

              {ancienLot && (
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
                  <p className="mb-1 text-xs tracking-wide text-zinc-500 uppercase">Ancien lot à l’établi</p>
                  <p className="text-zinc-300">
                    {formatNombre(ancienLot.tetes)} têtes → {formatNombre(pochonsPour(ancienLot.tetes))} pochons ·{' '}
                    {restantLot > 0 ? `encore ${formatRestant(restantLot)}` : 'terminé'}
                  </p>
                  {peutAgir && (
                    <div className="mt-2 flex justify-end gap-2">
                      {restantLot > 0 ? (
                        <Button
                          variant="danger"
                          className="py-1"
                          onClick={() => {
                            if (!window.confirm('Annuler ce lot ? Ses têtes retournent au stock.')) return
                            setErreurAction(null)
                            annulerLot(ancienLot, articles.data).catch((e: Error) => setErreurAction(e.message))
                          }}
                        >
                          Annuler
                        </Button>
                      ) : (
                        <Button className="py-1" onClick={() => setFenetre({ type: 'lot', lot: ancienLot })}>
                          Récupérer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-100">Entrées et sorties de stock, par jour</h2>
            <p className="text-sm text-zinc-500">
              Les {JOURS} dernières journées de jeu. Les mouvements sont notés depuis la mise en place de ce suivi.
            </p>
            <div className="grid items-start gap-4 xl:grid-cols-3">
              {SUIVIS.map((s) => {
                const { entrees, sorties } = flux(s.reference)
                return (
                  <EntreesSorties
                    key={s.reference}
                    titre={s.titre}
                    etiquettes={etiquettes}
                    entrees={entrees}
                    sorties={sorties}
                    format={formatNombre}
                  />
                )
              })}
            </div>
          </section>
        </>
      )}

      {fenetre?.type === 'zone' && (
        <ZoneModal
          action={fenetre.action}
          etat={etat}
          exact={zoneExacte(zone.data, maintenant)}
          lieux={lieux.data}
          articles={articles.data}
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

function Ligne({ valeur, unite }: { valeur: number; unite: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="w-16 text-right text-lg font-semibold text-zinc-50 tabular-nums">{formatNombre(valeur)}</span>
      <span className="text-zinc-400">{unite}</span>
    </li>
  )
}
