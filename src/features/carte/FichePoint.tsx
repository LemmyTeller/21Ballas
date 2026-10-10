import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { ETAPE_LABELS, TETES_PAR_PLANT, etatPlan, typePoint } from '../../lib/carte'
import { formatNombre, formatRestant } from '../../lib/format'
import type { Article, Lieu, PointCarte } from '../../types'
import { arroserPlan, recolterPlan, supprimerPoint } from './api'

// Fiche d'un point, ouverte en cliquant son marqueur : ce qu'on en sait et ce qu'on peut en faire.
// Arroser et récolter un plan sont ouverts à tous ; modifier, déplacer et supprimer à l'auteur et aux gradés.
export function FichePoint({
  point,
  maintenant,
  appartenance,
  auteur,
  peutGerer,
  lieux,
  articles,
  onModifier,
  onDeplacer,
  onClose,
}: {
  // Lieux de stockage et articles du Stock : la récolte d'un plan y fait entrer ses têtes
  lieux: Lieu[]
  articles: Article[]
  point: PointCarte
  maintenant: number
  // Nom du propriétaire d'un commerce, déjà résolu
  appartenance: string
  auteur: string
  peutGerer: boolean
  onModifier: () => void
  onDeplacer: () => void
  onClose: () => void
}) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  // Lieu où entrent les têtes à la récolte ; le premier lieu (le QG) par défaut, vide : stock non touché
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const plan = point.type === 'plan' ? etatPlan(point, maintenant) : null

  async function executer(action: () => Promise<void>) {
    setEnvoi(true)
    setErreur(null)
    try {
      await action()
      onClose()
    } catch (e) {
      setErreur((e as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={point.nom || typePoint(point.type).nom} onClose={onClose}>
      <dl className="space-y-1.5 text-sm">
        <Ligne titre="Type">{typePoint(point.type).nom}</Ligne>
        {point.type === 'commerce' && <Ligne titre="Appartenance">{appartenance}</Ligne>}
        {plan && point.etape && (
          <>
            <Ligne titre="Quantité">{formatNombre(point.quantite ?? 0)} plants</Ligne>
            <Ligne titre="Statut">
              {plan.etat === 'pret' ? (
                <span className="font-semibold text-yellow-400">Prêt à récolter</span>
              ) : plan.etat === 'arroser' ? (
                <span className="font-semibold text-sky-400">{ETAPE_LABELS[point.etape]} terminée — à arroser</span>
              ) : (
                <span className="font-semibold text-emerald-400">
                  {ETAPE_LABELS[point.etape]} — encore {formatRestant(plan.restant)}
                </span>
              )}
            </Ligne>
          </>
        )}
        {point.commentaire && (
          <Ligne titre="Commentaire">
            <span className="whitespace-pre-wrap">{point.commentaire}</span>
          </Ligne>
        )}
        <Ligne titre="Posé par">{auteur}</Ligne>
      </dl>

      {plan?.etat === 'pret' && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-sm text-zinc-300">
            La récolte rapporte{' '}
            <span className="font-semibold text-yellow-400">
              {formatNombre((point.quantite ?? 0) * TETES_PAR_PLANT)} têtes de weed
            </span>
            , ajoutées à la saisie journalière. Le plan disparaît de la carte.
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Têtes stockées dans</span>
            <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
              {lieux.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
              <option value="">Ne pas toucher au stock</option>
            </select>
          </label>
        </div>
      )}

      <ErrorMessage>{erreur}</ErrorMessage>
      <div className="flex flex-wrap justify-end gap-2">
        {peutGerer && (
          <>
            <Button
              variant="danger"
              className="mr-auto"
              disabled={envoi}
              onClick={() =>
                window.confirm('Supprimer ce point de la carte ?') && executer(() => supprimerPoint(point.id))
              }
            >
              Supprimer
            </Button>
            <Button variant="ghost" disabled={envoi} onClick={onDeplacer}>
              Déplacer
            </Button>
            <Button variant="ghost" disabled={envoi} onClick={onModifier}>
              Modifier
            </Button>
          </>
        )}
        {plan?.etat === 'arroser' && (
          <Button disabled={envoi} onClick={() => executer(() => arroserPlan(point))}>
            Arrosé
          </Button>
        )}
        {plan?.etat === 'pret' && (
          <Button disabled={envoi} onClick={() => executer(() => recolterPlan(point, lieuId || null, articles))}>
            Récolté
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </Modal>
  )
}

function Ligne({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-zinc-500">{titre}</dt>
      <dd className="min-w-0 text-zinc-100">{children}</dd>
    </div>
  )
}
