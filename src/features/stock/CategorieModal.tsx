import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { CategorieStock } from '../../types'
import { creerCategorie, renommerCategorie, supprimerCategorie } from './api'

// Création (sans `categorie`) ou modification. `articles` : nombre d'articles classés, une catégorie ne se supprime que vide.
export function CategorieModal({
  categorie,
  articles = 0,
  onClose,
}: {
  categorie?: CategorieStock
  articles?: number
  onClose: () => void
}) {
  const [nom, setNom] = useState(categorie?.nom ?? '')
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
    executer(() => (categorie ? renommerCategorie(categorie.id, nom) : creerCategorie(nom)))
  }

  function supprimer() {
    if (categorie && window.confirm(`Supprimer la catégorie « ${categorie.nom} » ?`)) {
      executer(() => supprimerCategorie(categorie.id))
    }
  }

  return (
    <Modal title={categorie ? 'Modifier la catégorie' : 'Ajouter une catégorie'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Nom de la catégorie (commune à tous les lieux)</span>
          <input
            className={inputClass}
            value={nom}
            maxLength={40}
            required
            autoFocus
            onChange={(e) => setNom(e.target.value)}
          />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {categorie && (
            <Button
              variant="danger"
              disabled={envoi || articles > 0}
              title={articles > 0 ? 'Vide d’abord la catégorie' : undefined}
              onClick={supprimer}
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
