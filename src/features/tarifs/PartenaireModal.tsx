import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Partenaire, Tarif, TypePartenaire } from '../../types'
import { TYPE_LABELS, creerPartenaire, majPartenaire, supprimerPartenaire } from './api'

// Création (sans `partenaire`) ou modification. `onCree` reçoit l'id du nouveau partenaire, pour le sélectionner.
export function PartenaireModal({
  partenaire,
  tarifs,
  onCree,
  onClose,
}: {
  partenaire?: Partenaire
  tarifs: Tarif[]
  onCree?: (id: string) => void
  onClose: () => void
}) {
  const [nom, setNom] = useState(partenaire?.nom ?? '')
  const [type, setType] = useState<TypePartenaire>(partenaire?.type ?? 'groupe')
  const [telephone, setTelephone] = useState(partenaire?.telephone ?? '')
  const [note, setNote] = useState(partenaire?.note ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

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
    const saisie = { nom, type, telephone, note }
    executer(async () => {
      if (partenaire) await majPartenaire(partenaire.id, saisie)
      else onCree?.(await creerPartenaire(saisie))
    })
  }

  function supprimer() {
    if (!partenaire) return
    const lignes = tarifs.filter((t) => t.partenaireId === partenaire.id).length
    const detail = lignes > 0 ? ` et ses ${lignes} ligne${lignes > 1 ? 's' : ''} de tarif` : ''
    if (window.confirm(`Supprimer ${partenaire.nom}${detail} ?`)) {
      executer(() => supprimerPartenaire(partenaire.id, tarifs))
    }
  }

  return (
    <Modal title={partenaire ? 'Modifier le partenaire' : 'Ajouter un partenaire'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
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
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Type</span>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as TypePartenaire)}>
            <option value="groupe">{TYPE_LABELS.groupe}</option>
            <option value="pm">{TYPE_LABELS.pm}</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Téléphone en jeu (facultatif)</span>
          <input className={inputClass} value={telephone} maxLength={20} onChange={(e) => setTelephone(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <textarea className={inputClass} rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {partenaire && (
            <Button variant="danger" disabled={envoi} onClick={supprimer}>
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !nom.trim()}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
