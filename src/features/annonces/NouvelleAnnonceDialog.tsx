import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Membre } from '../../types'
import { publierAnnonce } from './api'

export function NouvelleAnnonceDialog({ membre, onClose }: { membre: Membre; onClose: () => void }) {
  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function publier(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await publierAnnonce(membre, titre, contenu)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title="Nouvelle annonce" onClose={onClose}>
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
            Publier
          </Button>
        </div>
      </form>
    </Modal>
  )
}
