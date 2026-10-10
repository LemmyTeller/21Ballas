import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { DUREE_DEFAUT_MINUTES } from '../../lib/blanchiment'
import type { CommerceVille, GenreCommerce, Partenaire } from '../../types'
import { TYPES_AVEC_GRILLE, TYPE_PLURIELS, comparerPartenaires } from '../tarifs/api'
import {
  GENRES,
  GENRE_LABELS,
  PROPRIETAIRE_NOUS,
  creerCommerce,
  genreCommerce,
  majCommerce,
  supprimerCommerce,
} from './api'

const nombreSaisi = (valeur: string) => (valeur === '' ? null : Number(valeur))

// Création (sans `commerce`) ou modification d'un commerce recensé en ville.
// `occupe` : il y reste du sale ou du propre, il ne peut donc pas être supprimé.
export function CommerceModal({
  commerce,
  partenaires,
  occupe = false,
  onClose,
}: {
  commerce?: CommerceVille
  partenaires: Partenaire[]
  occupe?: boolean
  onClose: () => void
}) {
  const [zip, setZip] = useState(commerce?.zip ?? '')
  const [nom, setNom] = useState(commerce?.nom ?? '')
  const [description, setDescription] = useState(commerce?.description ?? '')
  // '' : propriétaire inconnu
  const [proprietaireId, setProprietaireId] = useState(commerce?.proprietaireId ?? '')
  const [genre, setGenre] = useState<GenreCommerce>(commerce ? genreCommerce(commerce) : 'standard')
  const [taux, setTaux] = useState(commerce?.taux?.toString() ?? '')
  // Nouveau commerce : la durée du jeu est proposée d'office (22 h pour un commerce plein)
  const duree = commerce ? commerce.dureeMinutes : DUREE_DEFAUT_MINUTES
  const [heures, setHeures] = useState(duree === null || duree === undefined ? '' : String(Math.floor(duree / 60)))
  const [minutes, setMinutes] = useState(duree === null || duree === undefined ? '' : String(duree % 60))
  const [montantMax, setMontantMax] = useState(commerce?.montantMax?.toString() ?? '')
  const [note, setNote] = useState(commerce?.note ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Seuls le Cartel et les groupes tiennent des commerces
  const groupes = (type: Partenaire['type']) => partenaires.filter((p) => p.type === type).sort(comparerPartenaires)

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

  function enregistrer(e: FormEvent) {
    e.preventDefault()
    const saisie = {
      zip,
      nom,
      description,
      proprietaireId: proprietaireId || null,
      genre,
      taux: nombreSaisi(taux),
      // Durée inconnue tant que ni les heures ni les minutes ne sont renseignées
      dureeMinutes: heures === '' && minutes === '' ? null : Number(heures) * 60 + Number(minutes),
      montantMax: nombreSaisi(montantMax),
      note,
    }
    executer(() => (commerce ? majCommerce(commerce.id, saisie) : creerCommerce(saisie)))
  }

  return (
    <Modal title={commerce ? 'Modifier le commerce' : 'Recenser un commerce'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Zip</span>
            <input
              className={inputClass}
              value={zip}
              maxLength={10}
              placeholder="9118"
              required
              autoFocus
              onChange={(e) => setZip(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Nom (facultatif)</span>
            <input className={inputClass} value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Description (facultatif)</span>
          <input
            className={inputClass}
            value={description}
            maxLength={300}
            placeholder="Repère, type de commerce…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Type de commerce</span>
          <select className={inputClass} value={genre} onChange={(e) => setGenre(e.target.value as GenreCommerce)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Appartenance</span>
          <select className={inputClass} value={proprietaireId} onChange={(e) => setProprietaireId(e.target.value)}>
            <option value={PROPRIETAIRE_NOUS}>À nous (Ballas)</option>
            {TYPES_AVEC_GRILLE.filter((type) => groupes(type).length > 0).map((type) => (
              <optgroup key={type} label={TYPE_PLURIELS[type]}>
                {groupes(type).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="">Inconnu</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Taux récupéré (%)</span>
            <input
              type="number"
              className={inputClass}
              value={taux}
              min={0}
              max={100}
              step="any"
              onChange={(e) => setTaux(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Plein blanchi en : heures</span>
            <input
              type="number"
              className={inputClass}
              value={heures}
              min={0}
              step={1}
              onChange={(e) => setHeures(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">minutes</span>
            <input
              type="number"
              className={inputClass}
              value={minutes}
              min={0}
              max={59}
              step={1}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Plafond du commerce ($ de sale)</span>
          <input
            type="number"
            className={inputClass}
            value={montantMax}
            min={0}
            step={1}
            onChange={(e) => setMontantMax(e.target.value)}
          />
        </label>
        <p className="text-xs text-zinc-500">
          Un taux de 70 % rend 7 000 $ de propre pour 10 000 $ de sale. La durée est le temps que met un commerce
          plein à tout blanchir. Les trois valeurs sont facultatives, mais il les faut toutes pour que l’appli estime
          le blanchiment d’un de nos commerces.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {commerce && (
            <Button
              variant="danger"
              disabled={envoi || occupe}
              title={occupe ? 'Il reste de l’argent dans ce commerce' : undefined}
              onClick={() => {
                if (window.confirm('Supprimer ce commerce de la liste ?')) executer(() => supprimerCommerce(commerce.id))
              }}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !zip.trim()}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
