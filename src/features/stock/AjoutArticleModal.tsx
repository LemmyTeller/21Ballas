import { useState, type FormEvent } from 'react'
import { ImageItem } from '../../components/ImageItem'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Article, CategorieStock, Lieu, Reference } from '../../types'
import { creerArticle, definirQuantite } from './api'
import { quantiteDans } from './useArticles'

const RESULTATS_MAX = 8

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
  const [recherche, setRecherche] = useState('')
  const [item, setItem] = useState<Reference | null>(null)
  const [quantite, setQuantite] = useState('1')
  const [prixAchat, setPrixAchat] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const terme = recherche.trim().toLocaleLowerCase('fr')
  const resultats = terme
    ? catalogue.filter((i) => i.name.toLocaleLowerCase('fr').includes(terme)).slice(0, RESULTATS_MAX)
    : []

  // Un item déjà suivi garde sa catégorie et ses prix : seule la quantité de ce lieu est saisie
  const existant = item ? articles.find((a) => a.id === item.cle) : undefined
  const categorieExistante = existant && categories.find((c) => c.id === existant.categorieId)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    setEnvoi(true)
    setErreur(null)
    try {
      if (existant) {
        await definirQuantite(existant.id, lieu.id, Number(quantite))
      } else {
        await creerArticle(item.cle, categorie.id, lieu.id, Number(quantite), {
          prixAchat: prixAchat === '' ? null : Number(prixAchat),
          prixVente: prixVente === '' ? null : Number(prixVente),
        })
      }
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Ajouter un item — ${categorie.nom} · ${lieu.nom}`} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {!item ? (
          <>
            <input
              type="search"
              className={inputClass}
              placeholder="Rechercher un item ou une arme"
              value={recherche}
              autoFocus
              onChange={(e) => setRecherche(e.target.value)}
            />
            <ul className="divide-y divide-zinc-800">
              {resultats.map((i) => (
                <li key={i.cle}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    onClick={() => setItem(i)}
                  >
                    <ImageItem item={i} dossier={i.dossier} />
                    <span className="flex-1">{i.name}</span>
                    {i.dossier === 'weapons' && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">Arme</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {terme && resultats.length === 0 && <p className="text-sm text-zinc-500">Aucun item ne correspond.</p>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ImageItem item={item} dossier={item.dossier} />
              <span className="flex-1 font-medium text-zinc-100">{item.name}</span>
              <Button variant="ghost" onClick={() => setItem(null)}>
                Changer
              </Button>
            </div>
            {existant && (
              <p className="rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-100">
                Cet item est déjà suivi dans la catégorie « {categorieExistante?.nom ?? 'Sans catégorie'} » : il la garde,
                ainsi que ses prix. Quantité actuelle dans {lieu.nom} : {quantiteDans(existant, lieu.id)}.
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
            {!existant && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-zinc-400">Prix d’achat ($, facultatif)</span>
                  <input
                    type="number"
                    className={inputClass}
                    value={prixAchat}
                    min={0}
                    step="any"
                    onChange={(e) => setPrixAchat(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-zinc-400">Prix de vente ($, facultatif)</span>
                  <input
                    type="number"
                    className={inputClass}
                    value={prixVente}
                    min={0}
                    step="any"
                    onChange={(e) => setPrixVente(e.target.value)}
                  />
                </label>
              </div>
            )}
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
