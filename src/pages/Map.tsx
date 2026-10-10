import { useMemo, useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { PROPRIETAIRE_NOUS } from '../features/blanchiment/api'
import { deplacerPoint } from '../features/carte/api'
import { Carte, type Marqueur } from '../features/carte/Carte'
import { FichePoint } from '../features/carte/FichePoint'
import { PointModal } from '../features/carte/PointModal'
import { usePoints } from '../features/carte/usePoints'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { useArticles } from '../features/stock/useArticles'
import { COULEUR_DEFAUT, comparerPartenaires } from '../features/tarifs/api'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { COULEURS_PLAN, ETAPE_LABELS, TYPES_POINT, etatPlan, typePoint } from '../lib/carte'
import { formatNombre, formatRestant } from '../lib/format'
import { useMaintenant } from '../lib/presence'
import { aAuMoins, nomAffiche } from '../lib/roles'
import type { PointCarte, TypePoint } from '../types'

// Ce que fera le prochain clic sur la carte
type Pose = { action: 'creer' } | { action: 'deplacer'; point: PointCarte }
type Fenetre = { position: { x: number; y: number } } | { point: PointCarte }

// Carte du serveur avec les points du groupe : commerces, plans de récolte, points d'intérêt, dangers
export function MapPage() {
  const moi = useMembre()
  const points = usePoints()
  const partenaires = usePartenaires()
  const membres = useMembres()
  // Stock : un plan y prend ses graines à la plantation et y rend ses têtes à la récolte
  const lieux = useLieux()
  const articles = useArticles()
  const maintenant = useMaintenant()
  const [masques, setMasques] = useState<TypePoint[]>([])
  const [pose, setPose] = useState<Pose | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  // Point dont la fiche est ouverte
  const [ficheId, setFicheId] = useState<string | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const estGrade = aAuMoins(moi, 'n2')

  const organisations = useMemo(
    () => partenaires.data.filter((p) => p.type !== 'pm').sort(comparerPartenaires),
    [partenaires.data],
  )
  const appartenance = (point: PointCarte) =>
    point.proprietaireId === PROPRIETAIRE_NOUS
      ? 'Ballas'
      : (partenaires.data.find((p) => p.id === point.proprietaireId)?.nom ?? 'Inconnue')

  // Les plans à récolter d'abord, puis ceux à arroser, puis ceux en pousse du plus avancé au moins avancé
  const ORDRE_ETATS = ['pret', 'arroser', 'pousse']
  const listePlans = points.data
    .filter((p) => p.type === 'plan')
    .map((point) => ({ point, ...etatPlan(point, maintenant) }))
    .sort((a, b) => ORDRE_ETATS.indexOf(a.etat) - ORDRE_ETATS.indexOf(b.etat) || a.restant - b.restant)
  const aArroser = listePlans.filter((p) => p.etat === 'arroser').length
  const prets = listePlans.filter((p) => p.etat === 'pret').length

  const deplace = pose?.action === 'deplacer' ? pose.point.id : null
  const marqueurs = useMemo<Marqueur[]>(
    () =>
      points.data
        .filter((p) => !masques.includes(p.type))
        .map((p) => {
          const base = { id: p.id, x: p.x, y: p.y, accent: p.id === deplace }
          if (p.type === 'plan' && p.etape) {
            const plan = etatPlan(p, maintenant)
            const quantite = `${formatNombre(p.quantite ?? 0)} plants`
            return {
              ...base,
              couleur: COULEURS_PLAN[plan.etat],
              titre: `${quantite} — ${ETAPE_LABELS[p.etape]}`,
              etiquette:
                plan.etat === 'pret' ? 'Prêt' : plan.etat === 'arroser' ? 'À arroser' : formatRestant(plan.restant),
              accent: base.accent || plan.etat !== 'pousse',
            }
          }
          // Un commerce prend la couleur de son groupe ; les nôtres et les inconnus gardent celle du type
          const groupe = p.type === 'commerce' ? partenaires.data.find((g) => g.id === p.proprietaireId) : undefined
          return {
            ...base,
            couleur: groupe ? (groupe.couleur ?? COULEUR_DEFAUT) : typePoint(p.type).couleur,
            titre: p.nom,
            etiquette: '',
          }
        }),
    [points.data, partenaires.data, masques, maintenant, deplace],
  )

  function clicCarte(position: { x: number; y: number }) {
    if (!pose) return
    if (pose.action === 'creer') setFenetre({ position })
    else {
      setErreurAction(null)
      deplacerPoint(pose.point.id, position).catch((e: Error) => setErreurAction(e.message))
    }
    setPose(null)
  }

  const fiche = points.data.find((p) => p.id === ficheId)

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Map</h1>
          <p className="text-sm text-zinc-400">
            {pose?.action === 'creer'
              ? 'Clique sur la carte à l’endroit du nouveau point.'
              : pose
                ? 'Clique sur la carte au nouvel emplacement du point.'
                : 'Clique un point pour ouvrir sa fiche.'}
          </p>
        </div>
        {pose ? (
          <Button variant="ghost" onClick={() => setPose(null)}>
            Annuler
          </Button>
        ) : (
          <Button onClick={() => setPose({ action: 'creer' })}>+ Point</Button>
        )}
      </header>

      <ErrorMessage>
        {points.error ?? partenaires.error ?? membres.error ?? lieux.error ?? articles.error ?? erreurAction}
      </ErrorMessage>

      {points.loading || partenaires.loading || lieux.loading || articles.loading ? (
        <Chargement />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtres : un clic masque ou réaffiche un type de point */}
            {TYPES_POINT.map((t) => {
              const visible = !masques.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={visible}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                    visible ? 'border-zinc-700 text-zinc-100' : 'border-zinc-800 text-zinc-600'
                  }`}
                  onClick={() => setMasques(visible ? [...masques, t.id] : masques.filter((m) => m !== t.id))}
                >
                  <span
                    className={`size-2.5 rounded-full ${visible ? '' : 'opacity-30'}`}
                    style={{ backgroundColor: t.couleur }}
                  />
                  {t.pluriel}
                  <span className="text-zinc-500 tabular-nums">{points.data.filter((p) => p.type === t.id).length}</span>
                </button>
              )
            })}
            {(aArroser > 0 || prets > 0) && (
              <p className="ml-auto text-sm font-medium">
                {aArroser > 0 && (
                  <span className="text-sky-400">
                    {aArroser} plan{aArroser > 1 ? 's' : ''} à arroser
                  </span>
                )}
                {aArroser > 0 && prets > 0 && <span className="text-zinc-600"> · </span>}
                {prets > 0 && (
                  <span className="text-yellow-400">
                    {prets} prêt{prets > 1 ? 's' : ''} à récolter
                  </span>
                )}
              </p>
            )}
          </div>

          {/* La carte, et à droite la liste des plans de récolte : ce qui demande une action d'abord */}
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <Carte marqueurs={marqueurs} pose={pose !== null} onClicCarte={clicCarte} onClicMarqueur={setFicheId} />
            <Card className="p-4! lg:max-h-[calc(100svh-15rem)] lg:overflow-y-auto" title="Plans de récolte">
              {listePlans.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun plan posé sur la carte.</p>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {listePlans.map(({ point, etat, restant }, index) => (
                    <li key={point.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-zinc-800"
                        onClick={() => setFicheId(point.id)}
                      >
                        <span
                          className="mt-1 size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: COULEURS_PLAN[etat] }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-zinc-100">
                            {point.commentaire || `Plan ${index + 1}`}
                          </span>
                          <span className="block text-xs text-zinc-400">
                            {point.etape && ETAPE_LABELS[point.etape]} · {formatNombre(point.quantite ?? 0)} plants
                          </span>
                        </span>
                        <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: COULEURS_PLAN[etat] }}>
                          {etat === 'pret' ? 'Prêt' : etat === 'arroser' ? 'À arroser' : formatRestant(restant)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {fiche && (
        <FichePoint
          point={fiche}
          maintenant={maintenant}
          appartenance={appartenance(fiche)}
          auteur={nomAffiche(membres.data.find((m) => m.uid === fiche.creeParUid))}
          peutGerer={estGrade || fiche.creeParUid === moi.uid}
          lieux={lieux.data}
          articles={articles.data}
          onModifier={() => {
            setFicheId(null)
            setFenetre({ point: fiche })
          }}
          onDeplacer={() => {
            setFicheId(null)
            setPose({ action: 'deplacer', point: fiche })
          }}
          onClose={() => setFicheId(null)}
        />
      )}

      {fenetre && (
        <PointModal
          point={'point' in fenetre ? fenetre.point : undefined}
          position={'position' in fenetre ? fenetre.position : undefined}
          partenaires={organisations}
          lieux={lieux.data}
          articles={articles.data}
          auteurUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}
