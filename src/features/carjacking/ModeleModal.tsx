import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurModele } from '../../components/SelecteurModele'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { ModeleVehicule, Partenaire } from '../../types'
import { TYPES_AVEC_GRILLE, TYPE_PLURIELS, comparerPartenaires } from '../tarifs/api'
import { ajouterCarjacking } from './api'

// Ajout d'une voiture à aller voler : un modèle du catalogue (ou un texte libre), le groupe demandeur
// s'il y en a un, et une note
export function ModeleModal({
  catalogue,
  partenaires,
  creeParUid,
  onClose,
}: {
  catalogue: ModeleVehicule[]
  partenaires: Partenaire[]
  creeParUid: string
  onClose: () => void
}) {
  const [modele, setModele] = useState<{ modele: string; spawn: string | null }>({ modele: '', spawn: null })
  // '' : pour aucun groupe
  const [partenaireId, setPartenaireId] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const groupes = (type: Partenaire['type']) => partenaires.filter((p) => p.type === type).sort(comparerPartenaires)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await ajouterCarjacking(modele, note, partenaireId || null, creeParUid)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title="Voiture à voler" onClose={onClose}>
      <form onSubmit={ajouter} className="space-y-3">
        <SelecteurModele catalogue={catalogue} modele={modele.modele} spawn={modele.spawn} onChange={setModele} />
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Demandée par un groupe ?</span>
          <select className={inputClass} value={partenaireId} onChange={(e) => setPartenaireId(e.target.value)}>
            <option value="">Non, aucun groupe</option>
            {TYPES_AVEC_GRILLE.filter((type) => groupes(type).length > 0).map((type) => (
              <optgroup key={type} label={TYPE_PLURIELS[type]}>
                {groupes(type).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input
            className={inputClass}
            value={note}
            maxLength={200}
            placeholder="Couleur, où la trouver…"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !modele.modele.trim()}>
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
