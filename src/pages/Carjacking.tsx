import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageVehicule } from '../components/ImageVehicule'
import { Modal } from '../components/Modal'
import { Button, Chargement, ErrorMessage } from '../components/ui'
import { marquerDepose, marquerVole, revenirEnArriere, supprimerCarjacking } from '../features/carjacking/api'
import { ModeleModal } from '../features/carjacking/ModeleModal'
import { RachatModal } from '../features/carjacking/RachatModal'
import { useCarjackings } from '../features/carjacking/useCarjackings'
import { libelleClasse, trouverModele } from '../features/gestion/modeles'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { useArticles } from '../features/stock/useArticles'
import { TuileCouleur } from '../features/tarifs/TuileCouleur'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { formatPrix } from '../lib/format'
import { aAuMoins, formatDate, nomAffiche } from '../lib/roles'
import { useModelesVehicules } from '../lib/useCatalogue'
import type { Carjacking as Fiche } from '../types'

type Fenetre = { type: 'modele' } | { type: 'rachat'; fiche: Fiche } | { type: 'historique' }

const HISTORIQUE_MAX = 50

const ETATS: Record<Exclude<Fiche['statut'], 'clos'>, { label: string; classe: string; rang: number }> = {
  a_voler: { label: 'À voler', classe: 'bg-zinc-800 text-zinc-200', rang: 0 },
  vole: { label: 'Volée', classe: 'bg-amber-950 text-amber-200', rang: 1 },
  depose: { label: 'Déposée', classe: 'bg-emerald-950 text-emerald-300', rang: 2 },
}

export function Carjacking() {
  const moi = useMembre()
  const fiches = useCarjackings()
  const membres = useMembres()
  const lieux = useLieux()
  const articles = useArticles()
  const catalogue = useModelesVehicules()
  const partenaires = usePartenaires()
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const estGrade = aAuMoins(moi, 'n2')
  const chargement = fiches.loading || membres.loading || !catalogue.items
  const nomMembre = (uid: string | undefined) => nomAffiche(membres.data.find((m) => m.uid === uid))
  const modele = (fiche: Fiche) => trouverModele(fiche, catalogue.items ?? [])
  // Groupe demandeur, s'il y en a un et qu'il existe toujours
  const groupe = (fiche: Fiche) => partenaires.data.find((p) => p.id === fiche.partenaireId)

  // À voler d'abord, puis volées, puis déposées ; dans chaque étape, la plus ancienne en premier
  const enCours = fiches.data
    .filter((f): f is Fiche & { statut: keyof typeof ETATS } => f.statut !== 'clos')
    .sort(
      (a, b) =>
        ETATS[a.statut].rang - ETATS[b.statut].rang ||
        (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity),
    )
  const historique = fiches.data
    .filter((f) => f.statut === 'clos')
    .sort((a, b) => (b.closAt?.toMillis() ?? Infinity) - (a.closAt?.toMillis() ?? Infinity))
    .slice(0, HISTORIQUE_MAX)

  const agir = (action: Promise<void>) => {
    setErreurAction(null)
    action.catch((e: Error) => setErreurAction(e.message))
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Carjacking</h1>
          <p className="text-sm text-zinc-400">Les voitures à aller voler, puis à déposer.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setFenetre({ type: 'historique' })}>
            Historique
          </Button>
          {estGrade && <Button onClick={() => setFenetre({ type: 'modele' })}>+ Modèle</Button>}
        </div>
      </header>

      <ErrorMessage>
        {fiches.error ?? membres.error ?? lieux.error ?? articles.error ?? catalogue.erreur ?? erreurAction}
      </ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : enCours.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aucune voiture à voler pour le moment.{estGrade && ' Ajoutes-en une avec « + Modèle ».'}
        </p>
      ) : (
        <div className="grid items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {enCours.map((fiche) => {
            const etat = ETATS[fiche.statut]
            const infos = modele(fiche)
            return (
              <article
                key={fiche.id}
                className="overflow-hidden rounded-xl border border-l-4 border-zinc-800 border-l-purple-600 bg-zinc-900"
              >
                <ImageVehicule spawn={infos?.spawn} className="aspect-video w-full rounded-none! bg-zinc-950/60 p-3" />
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-zinc-100">{fiche.modele}</h2>
                      {infos && (
                        <p className="text-xs text-zinc-500">
                          {[infos.marque, libelleClasse(infos.classe)].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${etat.classe}`}>
                      {etat.label}
                    </span>
                  </div>
                  {groupe(fiche) && (
                    <p className="flex items-center gap-2 text-sm text-zinc-300">
                      <TuileCouleur partenaire={groupe(fiche)!} className="size-3.5" />
                      Pour {groupe(fiche)!.nom}
                    </p>
                  )}
                  {fiche.note && <p className="text-sm text-zinc-400">{fiche.note}</p>}
                  {fiche.statut !== 'a_voler' && (
                    <p className="text-xs text-zinc-500">
                      Volée par {nomMembre(fiche.voleParUid)} le {formatDate(fiche.voleAt, true)}
                      {fiche.statut === 'depose' && (
                        <>
                          <br />
                          Déposée par {nomMembre(fiche.deposeParUid)} le {formatDate(fiche.deposeAt, true)}
                        </>
                      )}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {fiche.statut === 'a_voler' && (
                      <Button onClick={() => agir(marquerVole(fiche.id, moi.uid))}>Voler</Button>
                    )}
                    {fiche.statut === 'vole' && (
                      <Button onClick={() => agir(marquerDepose(fiche.id, moi.uid))}>Déposer</Button>
                    )}
                    {fiche.statut === 'depose' &&
                      (estGrade ? (
                        <Button onClick={() => setFenetre({ type: 'rachat', fiche })}>Rachat</Button>
                      ) : (
                        <span className="text-sm text-zinc-500">En attente du rachat</span>
                      ))}
                    {estGrade && (
                      <div className="ml-auto flex gap-3 text-xs">
                        {fiche.statut !== 'a_voler' && (
                          <button
                            type="button"
                            className="text-zinc-500 hover:text-purple-300"
                            title="Revenir à l’étape précédente"
                            onClick={() => agir(revenirEnArriere(fiche))}
                          >
                            Étape précédente
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-red-300"
                          onClick={() => {
                            if (window.confirm(`Supprimer la fiche « ${fiche.modele} » ?`)) {
                              agir(supprimerCarjacking(fiche.id))
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {fenetre?.type === 'modele' && (
        <ModeleModal
          catalogue={catalogue.items ?? []}
          partenaires={partenaires.data}
          creeParUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'rachat' && (
        <RachatModal
          carjacking={fenetre.fiche}
          lieux={lieux.data}
          articles={articles.data}
          acteurUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'historique' && (
        <Modal title="Historique des carjackings" onClose={() => setFenetre(null)}>
          {historique.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune voiture close pour le moment.</p>
          ) : (
            <ul className="max-h-[60svh] divide-y divide-zinc-800 overflow-y-auto pr-1 text-sm">
              {historique.map((fiche) => (
                <li key={fiche.id} className="flex gap-3 py-2">
                  <ImageVehicule spawn={modele(fiche)?.spawn} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-zinc-100">{fiche.modele}</span>
                      <span className="text-xs whitespace-nowrap text-zinc-500">{formatDate(fiche.closAt, true)}</span>
                    </div>
                    <p className={fiche.rachete ? 'font-semibold text-amber-400 tabular-nums' : 'text-zinc-500'}>
                      {fiche.rachete ? `Rachetée ${formatPrix(fiche.montant)} en sale` : 'Non rachetée'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {groupe(fiche) && `Pour ${groupe(fiche)!.nom} · `}
                      Volée par {nomMembre(fiche.voleParUid)} · déposée par {nomMembre(fiche.deposeParUid)}
                    </p>
                  </div>
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
