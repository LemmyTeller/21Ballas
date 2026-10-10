import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { REFERENCE_GRAINE, TETES_PAR_PLANT, TYPES_POINT, typePoint } from '../../lib/carte'
import { formatNombre } from '../../lib/format'
import type { Article, CommerceVille, Lieu, Partenaire, PointCarte, TypePoint } from '../../types'
import { PROPRIETAIRE_NOUS, nomCommerce } from '../blanchiment/api'
import { quantiteDans } from '../stock/useArticles'
import { creerPoint, modifierPoint } from './api'

// Valeur de la liste « Commerce » pour un commerce qui n'est pas recensé dans le Blanchiment
const LIBRE = 'libre'

// Nouveau point à la position cliquée, ou (avec `point`) modification d'un point : son type ne change pas
export function PointModal({
  point,
  position,
  partenaires,
  commerces,
  commercesPlaces,
  lieux,
  articles,
  auteurUid,
  onClose,
}: {
  // Commerces recensés dans l'onglet Blanchiment, et ids de ceux déjà posés sur la carte
  commerces: CommerceVille[]
  commercesPlaces: string[]
  // Lieux de stockage et articles du Stock : un nouveau plan y prend ses graines
  lieux: Lieu[]
  articles: Article[]
  point?: PointCarte
  position?: { x: number; y: number }
  // Organisations de l'Annuaire, pour l'appartenance d'un commerce
  partenaires: Partenaire[]
  auteurUid: string
  onClose: () => void
}) {
  // Plan de récolte par défaut : c'est le point qu'on pose le plus souvent
  const [type, setType] = useState<TypePoint>(point?.type ?? 'plan')
  const [nom, setNom] = useState(point?.nom ?? '')
  const [commentaire, setCommentaire] = useState(point?.commentaire ?? '')
  const [proprietaireId, setProprietaireId] = useState(point?.proprietaireId ?? '')
  const [quantite, setQuantite] = useState(point?.quantite != null ? String(point.quantite) : '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Lieu d'où sortent les graines d'un nouveau plan ; le premier lieu (le QG) par défaut, vide : stock non touché
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')

  // Commerce : rattaché à une fiche du Blanchiment (son id), saisi librement (LIBRE), ou pas encore choisi ('')
  const [lien, setLien] = useState(point ? (point.commerceId ?? LIBRE) : '')
  // Un commerce ne se pose qu'une fois : on ne propose que ceux qui ne sont pas encore sur la carte
  const disponibles = commerces
    .filter((c) => c.id === point?.commerceId || !commercesPlaces.includes(c.id))
    .sort((a, b) => a.zip.localeCompare(b.zip, 'fr', { numeric: true }))
  const commerceLie = commerces.find((c) => c.id === lien)
  const nomProprietaire = (id: string | null) =>
    id === PROPRIETAIRE_NOUS ? 'Ballas' : (partenaires.find((p) => p.id === id)?.nom ?? 'inconnu')

  const plan = type === 'plan'
  const plants = Math.max(0, Math.trunc(Number(quantite)))
  const valide = plan ? plants >= 1 : type === 'commerce' && lien !== LIBRE ? commerceLie !== undefined : nom.trim() !== ''
  const articleGraine = articles.find((a) => a.id === REFERENCE_GRAINE)
  const graines = articleGraine && lieuId ? quantiteDans(articleGraine, lieuId) : 0

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    const saisie = {
      // Rattaché à une fiche du Blanchiment : on garde une copie de son nom et de son propriétaire
      nom: commerceLie ? nomCommerce(commerceLie).slice(0, 60) : nom,
      commentaire,
      proprietaireId: commerceLie ? commerceLie.proprietaireId : proprietaireId || null,
      commerceId: commerceLie?.id ?? null,
      quantite: plan ? plants : null,
    }
    setEnvoi(true)
    setErreur(null)
    try {
      if (point) await modifierPoint(point, saisie)
      else if (position) await creerPoint(type, position, saisie, auteurUid, lieuId ? { lieuId, articles } : undefined)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={point ? `Modifier — ${typePoint(point.type).nom}` : 'Nouveau point'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {!point && (
          <div className="grid grid-cols-2 gap-2">
            {TYPES_POINT.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${
                  type === t.id ? 'border-purple-500 bg-purple-950/40' : 'border-zinc-800 hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  className="sr-only"
                  checked={type === t.id}
                  onChange={() => setType(t.id)}
                />
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.couleur }} />
                <span className="font-medium text-zinc-100">{t.nom}</span>
              </label>
            ))}
          </div>
        )}

        {plan ? (
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Quantité de plants</span>
            <input
              type="number"
              className={inputClass}
              value={quantite}
              min={1}
              step={1}
              required
              autoFocus
              onChange={(e) => setQuantite(e.target.value)}
            />
          </label>
        ) : (
          <>
            {type === 'commerce' && (
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Commerce</span>
                <select className={inputClass} value={lien} required onChange={(e) => setLien(e.target.value)}>
                  <option value="" disabled>
                    Choisir un commerce recensé dans Blanchiment…
                  </option>
                  {[
                    { titre: 'Nos commerces', liste: disponibles.filter((c) => c.proprietaireId === PROPRIETAIRE_NOUS) },
                    { titre: 'Autres commerces', liste: disponibles.filter((c) => c.proprietaireId !== PROPRIETAIRE_NOUS) },
                  ]
                    .filter((groupe) => groupe.liste.length > 0)
                    .map((groupe) => (
                      <optgroup key={groupe.titre} label={groupe.titre}>
                        {groupe.liste.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.zip} — {nomCommerce(c)} ({nomProprietaire(c.proprietaireId)})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  <option value={LIBRE}>Autre commerce (saisie libre)</option>
                </select>
              </label>
            )}
            {type === 'commerce' && commerceLie && (
              <p className="text-xs text-zinc-500">
                Le nom, le zip et l’appartenance du point suivront la fiche de ce commerce dans l’onglet Blanchiment.
              </p>
            )}
            {(type !== 'commerce' || lien === LIBRE) && (
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Nom</span>
                <input
                  className={inputClass}
                  value={nom}
                  maxLength={60}
                  required
                  autoFocus
                  onChange={(e) => setNom(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {type === 'commerce' && lien === LIBRE && (
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Appartenance</span>
            <select className={inputClass} value={proprietaireId} onChange={(e) => setProprietaireId(e.target.value)}>
              <option value="">Inconnue</option>
              <option value={PROPRIETAIRE_NOUS}>Ballas</option>
              {partenaires.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Commentaire{type === 'commerce' || plan ? ' (facultatif)' : ''}</span>
          <textarea
            className={inputClass}
            rows={3}
            value={commentaire}
            maxLength={300}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </label>

        {plan && !point && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Graines prises dans</span>
              <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
                {lieux.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
                <option value="">Ne pas toucher au stock</option>
              </select>
            </label>
            {lieuId && (
              <p className={`text-xs ${graines < plants ? 'text-amber-300' : 'text-zinc-500'}`}>
                {formatNombre(graines)} graine{graines > 1 ? 's' : ''} de weed dans ce lieu
                {graines < plants ? ' : pas assez, le stock tombera à 0.' : ` : il en sortira ${formatNombre(plants)}.`}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Le plan démarre en germination. Toutes les 30 minutes il faudra l’arroser, deux fois, avant de le
              récolter : {TETES_PAR_PLANT} têtes par plant.
            </p>
          </>
        )}
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !valide}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
