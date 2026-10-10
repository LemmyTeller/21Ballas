import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Annonce, Membre } from '../../types'
import { modifierAnnonce, publierAnnonce } from './api'

// Nouvelle annonce, ou (avec `annonce`) correction du titre et du message d'une annonce déjà publiée
export function NouvelleAnnonceDialog({
  membre,
  annonce,
  onClose,
}: {
  membre: Membre
  annonce?: Annonce
  onClose: () => void
}) {
  const [titre, setTitre] = useState(annonce?.titre ?? '')
  const [contenu, setContenu] = useState(annonce?.contenu ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function publier(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      if (annonce) await modifierAnnonce(annonce.id, titre, contenu)
      else await publierAnnonce(membre, titre, contenu)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={annonce ? 'Modifier l’annonce' : 'Nouvelle annonce'} onClose={onClose}>
      <form onSubmit={publier} className="space-y-3">
        <input
          className={inputClass}
          placeholder="Titre de l’annonce"
          value={titre}
          maxLength={120}
          required
          autoFocus
          onChange={(e) => setTitre(e.target.value)}
        />
        <textarea
          className={inputClass}
          placeholder="Message (facultatif)"
          rows={5}
          value={contenu}
          maxLength={4000}
          onChange={(e) => setContenu(e.target.value)}
        />
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !titre.trim()}>
            {annonce ? 'Enregistrer' : 'Publier'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
