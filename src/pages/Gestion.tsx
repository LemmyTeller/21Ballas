import { useState, type MouseEvent } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageVehicule } from '../components/ImageVehicule'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { LieuModal } from '../features/gestion/LieuModal'
import { classeSolde, couleursMembres, formatMontant, occupation } from '../features/gestion/outils'
import { PhotoVehicule } from '../features/gestion/PhotoVehicule'
import { SoldeModal } from '../features/gestion/SoldeForm'
import { useLieux } from '../features/gestion/useLieux'
import { useModeleDe } from '../features/gestion/useModeleDe'
import { useVehicules } from '../features/gestion/useVehicules'
import { VehiculeModal } from '../features/gestion/VehiculeModal'
import { useMembres } from '../features/members/useMembres'
import { quantiteDans, useArticles } from '../features/stock/useArticles'
import { aAuMoins, aLeDroitAdmin, estValide, nomAffiche, peutGerer, rang } from '../lib/roles'
import type { Lieu, Membre, Vehicule } from '../types'

type Vue = 'membres' | 'garages'

// Fenêtre ouverte : un véhicule à créer ou modifier, un lieu à créer ou modifier, un solde à corriger
type Fenetre =
  | { type: 'vehicule'; vehicule?: Vehicule }
  | { type: 'lieu'; lieu?: Lieu }
  | { type: 'solde'; membre: Membre }

export function Gestion() {
  const moi = useMembre()
  const membres = useMembres()
  const vehicules = useVehicules()
  const lieux = useLieux()
  // Seulement pour empêcher la suppression d'un lieu qui contient du stock
  const articles = useArticles()
  const [vue, setVue] = useState<Vue>('membres')
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)

  const estAdmin = aLeDroitAdmin(moi)
  const estGrade = aAuMoins(moi, 'n2')

  const valides = membres.data
    .filter((m) => estValide(m.role))
    .sort((a, b) => rang(b.role) - rang(a.role) || nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))
  const couleurs = couleursMembres(membres.data)
  const chargement = membres.loading || vehicules.loading || lieux.loading

  // Seul l'admin modifie les véhicules des autres ; chacun gère les siens dans Paramètres
  const ouvrirVehicule = estAdmin ? (vehicule: Vehicule) => setFenetre({ type: 'vehicule', vehicule }) : undefined

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Gestion</h1>
          <p className="text-sm text-zinc-400">
            Comptes, véhicules et garages du groupe. Chacun saisit ses véhicules et son solde dans ses paramètres.
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 p-0.5">
          {(['membres', 'garages'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                vue === v ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
              onClick={() => setVue(v)}
            >
              {v === 'membres' ? 'Membres' : 'Garages'}
            </button>
          ))}
        </div>
      </header>

      <ErrorMessage>{membres.error ?? vehicules.error ?? lieux.error}</ErrorMessage>

      {chargement ? (
        <Chargement />
      ) : vue === 'membres' ? (
        <VueMembres
          moi={moi}
          membres={valides}
          vehicules={vehicules.data}
          couleurs={couleurs}
          onVehicule={ouvrirVehicule}
          onSolde={(membre) => setFenetre({ type: 'solde', membre })}
        />
      ) : (
        <VueGarages
          membres={membres.data}
          vehicules={vehicules.data}
          lieux={lieux.data}
          couleurs={couleurs}
          onVehicule={ouvrirVehicule}
          onAjoutVehicule={estAdmin ? () => setFenetre({ type: 'vehicule' }) : undefined}
          onLieu={estGrade ? (lieu) => setFenetre({ type: 'lieu', lieu }) : undefined}
        />
      )}

      {fenetre?.type === 'vehicule' && (
        <VehiculeModal
          vehicule={fenetre.vehicule}
          proprietaireUid={moi.uid}
          proprietaires={valides}
          lieux={lieux.data}
          vehicules={vehicules.data}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'lieu' && (
        <LieuModal
          lieu={fenetre.lieu}
          occupes={fenetre.lieu ? occupation(fenetre.lieu, vehicules.data) : 0}
          stock={fenetre.lieu ? articles.data.filter((a) => quantiteDans(a, fenetre.lieu!.id) > 0).length : 0}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'solde' && <SoldeModal membre={fenetre.membre} onClose={() => setFenetre(null)} />}
    </>
  )
}

// Nom d'un véhicule, à la couleur de son propriétaire. `avecApercu` : la photo s'affiche au survol
// (vue Membres, où il n'y a pas de vignette pour garder le tableau compact).
function EtiquetteVehicule({
  vehicule,
  couleur,
  avecApercu = false,
  onClick,
}: {
  vehicule: Vehicule
  couleur: string | undefined
  avecApercu?: boolean
  onClick?: (vehicule: Vehicule) => void
}) {
  const modele = useModeleDe(vehicule)
  // Position de la vignette affichée au survol, sous l'étiquette ; null quand la souris n'est pas dessus
  const [apercu, setApercu] = useState<{ gauche: number; haut: number } | null>(null)

  const libelle = (
    <>
      {vehicule.modele}
      {vehicule.note && <span title={vehicule.note}>*</span>}
    </>
  )
  const classe = `font-medium ${couleur ?? 'text-zinc-300'}`
  const survol = {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      if (!avecApercu || !modele) return
      const cadre = e.currentTarget.getBoundingClientRect()
      setApercu({ gauche: cadre.left, haut: cadre.bottom + 6 })
    },
    onMouseLeave: () => setApercu(null),
  }

  return (
    <>
      {onClick ? (
        <button type="button" className={`${classe} hover:underline`} onClick={() => onClick(vehicule)} {...survol}>
          {libelle}
        </button>
      ) : (
        <span className={classe} {...survol}>
          {libelle}
        </span>
      )}
      {apercu && modele && (
        <span
          className="pointer-events-none fixed z-30 block rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
          style={{ left: apercu.gauche, top: apercu.haut }}
        >
          <ImageVehicule spawn={modele.spawn} className="h-24 w-40" />
        </span>
      )}
    </>
  )
}

function VueMembres({
  moi,
  membres,
  vehicules,
  couleurs,
  onVehicule,
  onSolde,
}: {
  moi: Membre
  membres: Membre[]
  vehicules: Vehicule[]
  couleurs: Map<string, string>
  onVehicule?: (vehicule: Vehicule) => void
  onSolde: (membre: Membre) => void
}) {
  const total = membres.reduce((somme, m) => somme + (m.compteBancaire ?? 0), 0)

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-2 font-medium">Membre</th>
              <th className="pb-2 font-medium">Tél</th>
              <th className="pb-2 font-medium">Anniv</th>
              <th className="pb-2 text-right font-medium">Compte bancaire</th>
              <th className="pb-2 pl-6 font-medium">Véhicules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {membres.map((m) => {
              const siens = vehicules
                .filter((v) => v.proprietaireUid === m.uid)
                .sort((a, b) => a.modele.localeCompare(b.modele, 'fr'))
              return (
                <tr key={m.uid}>
                  <td className={`py-2.5 pr-4 font-medium whitespace-nowrap ${couleurs.get(m.uid) ?? 'text-zinc-100'}`}>
                    {nomAffiche(m)}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-300">{m.telephoneRP || '—'}</td>
                  <td className="py-2.5 pr-4 text-zinc-300">{m.anniversaireRP || '—'}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {peutGerer(moi, m) && (
                      <button
                        type="button"
                        className="mr-2 text-xs text-zinc-500 hover:text-purple-300"
                        onClick={() => onSolde(m)}
                      >
                        Corriger
                      </button>
                    )}
                    <span
                      className={`inline-block min-w-24 rounded-md px-2 py-0.5 text-right font-semibold tabular-nums ${classeSolde(m.compteBancaire)}`}
                    >
                      {formatMontant(m.compteBancaire)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-6">
                    {siens.length === 0 ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {siens.map((v) => (
                          <EtiquetteVehicule
                            key={v.id}
                            vehicule={v}
                            couleur={couleurs.get(m.uid)}
                            avecApercu
                            onClick={onVehicule}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-700">
              <td colSpan={3} className="pt-3 text-xs uppercase tracking-wide text-zinc-500">
                Total du groupe
              </td>
              <td className="pt-3 text-right">
                <span className="inline-block min-w-24 rounded-md bg-purple-800 px-2 py-0.5 text-right font-bold text-white tabular-nums">
                  {formatMontant(total)}
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

function VueGarages({
  membres,
  vehicules,
  lieux,
  couleurs,
  onVehicule,
  onAjoutVehicule,
  onLieu,
}: {
  membres: Membre[]
  vehicules: Vehicule[]
  lieux: Lieu[]
  couleurs: Map<string, string>
  onVehicule?: (vehicule: Vehicule) => void
  onAjoutVehicule?: () => void
  onLieu?: (lieu?: Lieu) => void
}) {
  // Un véhicule dont le garage n'existe plus retombe dans « Sans garage »
  const sansGarage = vehicules.filter((v) => !lieux.some((l) => l.id === v.lieuId))

  function liste(gares: Vehicule[]) {
    if (gares.length === 0) return <p className="text-sm text-zinc-600">Aucun véhicule.</p>
    return (
      <ul className="divide-y divide-zinc-800 text-sm">
        {[...gares]
          .sort((a, b) => a.modele.localeCompare(b.modele, 'fr'))
          .map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-1.5">
              <PhotoVehicule vehicule={v} className="h-9 w-14" />
              <span className="min-w-0 flex-1 truncate">
                <EtiquetteVehicule vehicule={v} couleur={couleurs.get(v.proprietaireUid)} onClick={onVehicule} />
              </span>
              <span className="font-mono text-xs text-zinc-300">{v.plaque || '—'}</span>
              <span className="w-24 truncate text-right text-xs text-zinc-500">
                {nomAffiche(membres.find((m) => m.uid === v.proprietaireUid))}
              </span>
            </li>
          ))}
      </ul>
    )
  }

  return (
    <>
      {(onAjoutVehicule || onLieu) && (
        <div className="flex flex-wrap gap-2">
          {onAjoutVehicule && <Button onClick={onAjoutVehicule}>+ Véhicule</Button>}
          {onLieu && (
            <Button variant="ghost" onClick={() => onLieu()}>
              + Lieu
            </Button>
          )}
        </div>
      )}

      {lieux.length === 0 && sansGarage.length === 0 && (
        <p className="text-sm text-zinc-500">Aucun lieu ni véhicule pour le moment.</p>
      )}

      <div className="grid items-start gap-6 md:grid-cols-2">
        {lieux.map((lieu) => {
          const gares = vehicules.filter((v) => v.lieuId === lieu.id)
          const plein = gares.length >= lieu.capacite
          return (
            <Card
              key={lieu.id}
              title={lieu.nom}
              action={
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
                      plein ? 'bg-red-950 text-red-300' : 'bg-zinc-800 text-zinc-200'
                    }`}
                    title="Places occupées / places du garage"
                  >
                    {gares.length} / {lieu.capacite}
                  </span>
                  {onLieu && (
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-purple-300"
                      onClick={() => onLieu(lieu)}
                    >
                      Modifier
                    </button>
                  )}
                </div>
              }
            >
              {liste(gares)}
            </Card>
          )
        })}
        {sansGarage.length > 0 && (
          <Card
            title="Sans garage"
            action={<span className="text-sm text-zinc-500 tabular-nums">{sansGarage.length}</span>}
          >
            {liste(sansGarage)}
          </Card>
        )}
      </div>
    </>
  )
}
