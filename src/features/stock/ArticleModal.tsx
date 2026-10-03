import { useEffect, useState, type FormEvent } from 'react'
import { ImageItem } from '../../components/ImageItem'
import { Modal } from '../../components/Modal'
import { Button, Chargement, ErrorMessage, inputClass } from '../../components/ui'
import type { Article, CategorieStock, Lieu, Reference } from '../../types'
import { definirQuantite, lirePrix, majArticle, retirerDuLieu, supprimerArticle } from './api'
import { quantiteDans } from './useArticles'

// Détail d'un article, réservé aux gradés : catégorie, prix, et quantité dans `lieu` (absent depuis l'onglet Global)
export function ArticleModal({
  article,
  item,
  lieu,
  categories,
  onClose,
}: {
  article: Article
  item: Reference | undefined
  lieu?: Lieu
  categories: CategorieStock[]
  onClose: () => void
}) {
  const [categorieId, setCategorieId] = useState(article.categorieId)
  const [quantite, setQuantite] = useState(lieu ? String(quantiteDans(article, lieu.id)) : '')
  // `null` tant que les prix ne sont pas chargés
  const [prix, setPrix] = useState<{ achat: string; vente: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    lirePrix(article.id)
      .then((p) => actif && setPrix({ achat: String(p?.prixAchat ?? ''), vente: String(p?.prixVente ?? '') }))
      .catch((e: Error) => {
        if (!actif) return
        setErreur(e.message)
        setPrix({ achat: '', vente: '' })
      })
    return () => {
      actif = false
    }
  }, [article.id])

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
    if (!prix) return
    executer(async () => {
      await majArticle(article.id, categorieId, {
        prixAchat: prix.achat === '' ? null : Number(prix.achat),
        prixVente: prix.vente === '' ? null : Number(prix.vente),
      })
      if (lieu && Number(quantite) !== quantiteDans(article, lieu.id)) {
        await definirQuantite(article.id, lieu.id, Number(quantite))
      }
    })
  }

  const nom = item?.name ?? `Item #${article.id}`

  return (
    <Modal title={nom} onClose={onClose}>
      {!prix ? (
        <Chargement />
      ) : (
        <form onSubmit={enregistrer} className="space-y-3">
          <div className="flex items-center gap-3">
            <ImageItem item={item} dossier={item?.dossier} />
            <span className="text-sm text-zinc-400">{lieu ? `Stock dans ${lieu.nom}` : 'Tous les lieux'}</span>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Catégorie (commune à tous les lieux)</span>
            <select className={inputClass} value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
              {!categories.some((c) => c.id === categorieId) && <option value={categorieId}>Sans catégorie</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Prix d’achat ($, facultatif)</span>
              <input
                type="number"
                className={inputClass}
                value={prix.achat}
                min={0}
                step="any"
                onChange={(e) => setPrix({ ...prix, achat: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Prix de vente ($, facultatif)</span>
              <input
                type="number"
                className={inputClass}
                value={prix.vente}
                min={0}
                step="any"
                onChange={(e) => setPrix({ ...prix, vente: e.target.value })}
              />
            </label>
          </div>
          {lieu && (
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
          )}
          <ErrorMessage>{erreur}</ErrorMessage>
          <div className="flex flex-wrap gap-2">
            {lieu ? (
              <Button
                variant="danger"
                disabled={envoi}
                onClick={() => {
                  if (window.confirm(`Retirer ${nom} de ${lieu.nom} ?`)) executer(() => retirerDuLieu(article.id, lieu.id))
                }}
              >
                Retirer de ce lieu
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={envoi}
                onClick={() => {
                  if (window.confirm(`Supprimer ${nom} du stock, dans tous les lieux ?`)) {
                    executer(() => supprimerArticle(article.id))
                  }
                }}
              >
                Supprimer l’article
              </Button>
            )}
            <Button variant="ghost" className="ml-auto" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={envoi || (lieu !== undefined && quantite === '')}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
