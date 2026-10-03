import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Article, CategorieStock, Lieu, Reference } from '../../types'
import { creerArticle, definirQuantite } from './api'
import { quantiteDans } from './useArticles'

// Ajout d'un item ou d'une arme du catalogue dans une catégorie, pour un lieu donné
export function AjoutArticleModal({
  categorie,
  lieu,
  catalogue,
  articles,
  categories,
  onClose,
}: {
  categorie: CategorieStock
  lieu: Lieu
  catalogue: Reference[]
  articles: Article[]
  categories: CategorieStock[]
  onClose: () => void
}) {
  const [item, setItem] = useState<Reference | null>(null)
  const [quantite, setQuantite] = useState('1')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Un item déjà suivi garde sa catégorie : seule la quantité de ce lieu est saisie
  const existant = item ? articles.find((a) => a.id === item.cle) : undefined
  const categorieExistante = existant && categories.find((c) => c.id === existant.categorieId)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (existant) await definirQuantite(existant.id, lieu.id, Number(quantite))
      else await creerArticle(item.cle, categorie.id, lieu.id, Number(quantite))
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Ajouter un item — ${categorie.nom} · ${lieu.nom}`} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <SelecteurReference catalogue={catalogue} selection={item} onSelection={setItem} />
        {item && (
          <>
            {existant && (
              <p className="rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-100">
                Cet item est déjà suivi dans la catégorie « {categorieExistante?.nom ?? 'Sans catégorie'} » : il la garde.
                Quantité actuelle dans {lieu.nom} : {quantiteDans(existant, lieu.id)}.
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Quantité dans {lieu.nom}</span>
              <input
                type="number"
                className={inputClass}
                value={quantite}
                min={0}
                step={1}
                required
                onChange={(e) => setQuantite(e.target.value)}
              />
            </label>
          </>
        )}
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !item || quantite === ''}>
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
