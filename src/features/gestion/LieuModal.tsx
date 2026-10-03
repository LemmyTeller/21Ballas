import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Lieu } from '../../types'
import { creerLieu, majLieu, supprimerLieu } from './api'

// Création (sans `lieu`) ou modification. Un lieu ne se supprime que vide :
// `occupes` = véhicules garés, `stock` = articles qui y sont stockés.
export function LieuModal({
  lieu,
  occupes = 0,
  stock = 0,
  onClose,
}: {
  lieu?: Lieu
  occupes?: number
  stock?: number
  onClose: () => void
}) {
  const [nom, setNom] = useState(lieu?.nom ?? '')
  const [capacite, setCapacite] = useState(String(lieu?.capacite ?? ''))
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
    const saisie = { nom, capacite: Number(capacite) }
    executer(() => (lieu ? majLieu(lieu.id, saisie) : creerLieu(saisie)))
  }

  function supprimer() {
    if (lieu && window.confirm(`Supprimer le lieu « ${lieu.nom} » ?`)) executer(() => supprimerLieu(lieu.id))
  }

  return (
    <Modal title={lieu ? 'Modifier le lieu' : 'Ajouter un lieu'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Nom (QG, Maison de…)</span>
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
          <span className="text-zinc-400">Places de garage</span>
          <input
            type="number"
            className={inputClass}
            value={capacite}
            min={0}
            max={200}
            step={1}
            required
            onChange={(e) => setCapacite(e.target.value)}
          />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {lieu && (
            <Button
              variant="danger"
              disabled={envoi || occupes > 0 || stock > 0}
              title={occupes > 0 ? 'Vide d’abord le garage' : stock > 0 ? 'Vide d’abord le stock de ce lieu' : undefined}
              onClick={supprimer}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !nom.trim() || capacite === ''}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
