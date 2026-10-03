import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Contact, Partenaire, TypePartenaire } from '../../types'
import { TYPES_PARTENAIRE, TYPE_PLURIELS } from '../tarifs/api'
import { creerContact, majContact, supprimerContact } from './api'

// Création (sans `contact`) ou modification d'une fiche de l'Annuaire
export function ContactModal({
  contact,
  partenaires,
  onClose,
}: {
  contact?: Contact
  partenaires: Partenaire[]
  onClose: () => void
}) {
  const [nom, setNom] = useState(contact?.nom ?? '')
  const [telephone, setTelephone] = useState(contact?.telephone ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [partenaireId, setPartenaireId] = useState(contact?.partenaireId ?? '')
  const [informations, setInformations] = useState(contact?.informations ?? '')
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
    const saisie = { nom, telephone, role, partenaireId: partenaireId || null, informations }
    executer(() => (contact ? majContact(contact.id, saisie) : creerContact(saisie)))
  }

  const parType = (type: TypePartenaire) =>
    partenaires.filter((p) => p.type === type).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  return (
    <Modal title={contact ? 'Modifier le contact' : 'Ajouter un contact'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Nom (prénom et nom du personnage)</span>
          <input
            className={inputClass}
            value={nom}
            maxLength={60}
            required
            autoFocus
            onChange={(e) => setNom(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Téléphone en jeu</span>
            <input className={inputClass} value={telephone} maxLength={20} onChange={(e) => setTelephone(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Rôle</span>
            <input
              className={inputClass}
              value={role}
              maxLength={60}
              placeholder="Chef, vendeur, patron…"
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Organisation</span>
          <select className={inputClass} value={partenaireId} onChange={(e) => setPartenaireId(e.target.value)}>
            <option value="">Aucune</option>
            {TYPES_PARTENAIRE.filter((type) => parType(type).length > 0).map((type) => (
              <optgroup key={type} label={TYPE_PLURIELS[type]}>
                {parType(type).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Informations</span>
          <textarea
            className={inputClass}
            rows={4}
            value={informations}
            maxLength={1000}
            onChange={(e) => setInformations(e.target.value)}
          />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {contact && (
            <Button
              variant="danger"
              disabled={envoi}
              onClick={() => {
                if (window.confirm(`Supprimer ${contact.nom} de l’annuaire ?`)) executer(() => supprimerContact(contact.id))
              }}
            >
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
