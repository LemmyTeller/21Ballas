import { useEffect, useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageItem } from '../components/ImageItem'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { useLieux } from '../features/gestion/useLieux'
import { AjoutArticleModal } from '../features/stock/AjoutArticleModal'
import { ajusterQuantite, definirQuantite } from '../features/stock/api'
import { ArticleModal } from '../features/stock/ArticleModal'
import { CategorieModal } from '../features/stock/CategorieModal'
import { quantiteDans, useArticles } from '../features/stock/useArticles'
import { useCategories } from '../features/stock/useCategories'
import { ESPACE_INSECABLE, formatNombre, formatPoids } from '../lib/format'
import { aAuMoins } from '../lib/roles'
import { useReferences } from '../lib/useCatalogue'
import type { Article, CategorieStock, Reference } from '../types'

const GLOBAL = 'global'

type Fenetre =
  | { type: 'categorie'; categorie?: CategorieStock }
  | { type: 'ajout'; categorie: CategorieStock }
  | { type: 'article'; article: Article }

// Poids maximal que le groupe peut stocker, tous lieux confondus
const POIDS_MAX_KG = 4200

const nombre = { format: formatNombre }

// 3 colonnes sur grand écran, 2 sur écran moyen, 1 en dessous
function useNombreColonnes(): number {
  const calculer = () => (window.innerWidth >= 1536 ? 3 : window.innerWidth >= 1024 ? 2 : 1)
  const [nb, setNb] = useState(calculer)

  useEffect(() => {
    const surRedimension = () => setNb(calculer())
    window.addEventListener('resize', surRedimension)
    return () => window.removeEventListener('resize', surRedimension)
  }, [])

  return nb
}

export function Stock() {
  const moi = useMembre()
  const lieux = useLieux()
  const categories = useCategories()
  const articles = useArticles()
  // Items et armes du catalogue
  const catalogue = useReferences()
  const [onglet, setOnglet] = useState(GLOBAL)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const nbColonnes = useNombreColonnes()

  const estGrade = aAuMoins(moi.role, 'n2')
  // Un lieu supprimé pendant qu'on le consulte ramène sur Global
  const lieu = lieux.data.find((l) => l.id === onglet)
  const chargement = lieux.loading || categories.loading || articles.loading || !catalogue.items

  const item = (article: Article): Reference | undefined => catalogue.items?.find((r) => r.cle === article.id)
  const nom = (article: Article) => item(article)?.name ?? `Item #${article.id}`
  // Total sur les lieux existants uniquement
  const total = (article: Article) => lieux.data.reduce((somme, l) => somme + quantiteDans(article, l.id), 0)

  // Quantité et poids d'un article dans l'onglet courant (un lieu, ou tous dans Global)
  const quantiteAffichee = (article: Article) => (lieu ? quantiteDans(article, lieu.id) : total(article))
  const poids = (article: Article) => quantiteAffichee(article) * (item(article)?.weight ?? 0)
  const poidsTotal = articles.data.reduce((somme, a) => somme + poids(a), 0)

  // Articles affichés dans l'onglet courant : tous dans Global, ceux présents dans le lieu sinon
  const visibles = articles.data
    .filter((a) => !lieu || lieu.id in a.quantites)
    .sort((a, b) => nom(a).localeCompare(nom(b), 'fr'))

  const sections: { categorie?: CategorieStock; articles: Article[] }[] = categories.data.map((categorie) => ({
    categorie,
    articles: visibles.filter((a) => a.categorieId === categorie.id),
  }))
  const sansCategorie = visibles.filter((a) => !categories.data.some((c) => c.id === a.categorieId))
  if (sansCategorie.length > 0) sections.push({ articles: sansCategorie })

  // Cartes rangées en colonnes : chacune va dans la colonne la moins remplie, pour éviter les trous
  // qu'une grille laisse sous les cartes courtes. Une catégorie vide n'intéresse que les gradés.
  const colonnes: (typeof sections)[] = Array.from({ length: nbColonnes }, () => [])
  const hauteurs = colonnes.map(() => 0)
  for (const section of sections.filter((s) => s.articles.length > 0 || estGrade)) {
    const cible = hauteurs.indexOf(Math.min(...hauteurs))
    colonnes[cible].push(section)
    // Hauteur approchée : l'en-tête et les marges comptent pour deux lignes
    hauteurs[cible] += section.articles.length + 2
  }

  const agir = (action: Promise<void>) => {
    setErreurAction(null)
    action.catch((e: Error) => setErreurAction(e.message))
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Stock</h1>
          <p className="text-sm text-zinc-400">
            {lieu ? `Ce qui est stocké dans ${lieu.nom}.` : 'Total de tous les lieux de stockage.'}
          </p>
        </div>
        {estGrade && <Button onClick={() => setFenetre({ type: 'categorie' })}>+ Catégorie</Button>}
      </header>

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-800">
        {[{ id: GLOBAL, nom: 'Global' }, ...lieux.data].map((o) => (
          <button
            key={o.id}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
              (lieu?.id ?? GLOBAL) === o.id
                ? 'border-purple-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-100'
            }`}
            onClick={() => setOnglet(o.id)}
          >
            {o.nom}
          </button>
        ))}
      </nav>

      <ErrorMessage>{lieux.error ?? categories.error ?? articles.error ?? catalogue.erreur ?? erreurAction}</ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : (
        <>
          {lieu ? (
            <p className="text-sm text-zinc-400">
              Poids stocké dans {lieu.nom} : <span className="font-semibold text-zinc-100">{formatPoids(poidsTotal)}</span>
            </p>
          ) : (
            <JaugePoids poids={poidsTotal} />
          )}
          {lieux.data.length === 0 && (
            <p className="text-sm text-zinc-500">
              Aucun lieu de stockage : crée d’abord un lieu dans l’onglet Gestion, vue Garages.
            </p>
          )}
          {categories.data.length === 0 && (
            <p className="text-sm text-zinc-500">
              Aucune catégorie pour le moment.{estGrade && ' Commence par en créer une avec « + Catégorie ».'}
            </p>
          )}
          <div className="flex items-start gap-4">
            {colonnes.map((colonne, c) => (
              <div key={c} className="flex min-w-0 flex-1 flex-col gap-4">
                {colonne.map(({ categorie, articles: lignes }) => (
              <Card
                key={categorie?.id ?? 'sans'}
                title={categorie?.nom ?? 'Sans catégorie'}
                action={
                  estGrade &&
                  categorie && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:text-purple-300"
                        onClick={() => setFenetre({ type: 'categorie', categorie })}
                      >
                        Modifier
                      </button>
                      {lieu && <Button onClick={() => setFenetre({ type: 'ajout', categorie })}>+ Item</Button>}
                    </div>
                  )
                }
              >
                {lignes.length === 0 ? (
                  <p className="text-sm text-zinc-600">
                    {lieu ? `Rien dans ${lieu.nom}.` : 'Aucun item dans cette catégorie.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {lignes.map((article) => {
                      const quantite = quantiteAffichee(article)
                      const repartition = lieux.data
                        .filter((l) => quantiteDans(article, l.id) > 0)
                        .map((l) => `${l.nom} ${nombre.format(quantiteDans(article, l.id))}`)
                        .join(' · ')
                      return (
                        <li key={article.id} className={`flex items-center gap-3 py-2 ${quantite === 0 ? 'opacity-50' : ''}`}>
                          <ImageItem item={item(article)} dossier={item(article)?.dossier} />
                          <div className="min-w-0 flex-1">
                            {estGrade ? (
                              <button
                                type="button"
                                className="text-left text-sm leading-tight font-medium text-zinc-100 hover:underline"
                                onClick={() => setFenetre({ type: 'article', article })}
                              >
                                {nom(article)}
                              </button>
                            ) : (
                              <p className="text-sm leading-tight font-medium text-zinc-100">{nom(article)}</p>
                            )}
                            <p className="text-xs text-zinc-500">
                              <span className="text-zinc-300">{formatPoids(poids(article))}</span>
                              {!lieu && ` · ${repartition || 'Rupture de stock'}`}
                            </p>
                          </div>
                          {lieu && estGrade ? (
                            <QuantiteEditeur
                              // Remonté quand la quantité change côté serveur, pour repartir de la valeur à jour
                              key={quantite}
                              quantite={quantite}
                              onAjuster={(delta) => agir(ajusterQuantite(article.id, lieu.id, delta))}
                              onDefinir={(valeur) => agir(definirQuantite(article.id, lieu.id, valeur))}
                            />
                          ) : (
                            <span className="text-base font-semibold text-zinc-100 tabular-nums">
                              {nombre.format(quantite)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {fenetre?.type === 'categorie' && (
        <CategorieModal
          categorie={fenetre.categorie}
          articles={articles.data.filter((a) => a.categorieId === fenetre.categorie?.id).length}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'ajout' && lieu && catalogue.items && (
        <AjoutArticleModal
          categorie={fenetre.categorie}
          lieu={lieu}
          catalogue={catalogue.items}
          articles={articles.data}
          categories={categories.data}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'article' && (
        <ArticleModal
          article={fenetre.article}
          item={item(fenetre.article)}
          lieu={lieu}
          categories={categories.data}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}

// Poids total stocké par rapport à la capacité du groupe ; vire à l'orange puis au rouge en approchant du maximum
function JaugePoids({ poids }: { poids: number }) {
  const taux = poids / POIDS_MAX_KG
  const couleur = taux >= 0.9 ? 'bg-red-500' : taux >= 0.75 ? 'bg-amber-500' : 'bg-purple-600'

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-400">Poids total stocké</h2>
        <p className="text-sm text-zinc-400">
          <span className="text-xl font-bold text-zinc-50 tabular-nums">{formatPoids(poids)}</span> /{' '}
          {formatPoids(POIDS_MAX_KG)} · {nombre.format(taux * 100)}{ESPACE_INSECABLE}%
        </p>
      </div>
      <div
        role="meter"
        aria-label="Poids total stocké"
        aria-valuemin={0}
        aria-valuemax={POIDS_MAX_KG}
        aria-valuenow={Math.round(poids)}
        className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800"
      >
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.min(100, taux * 100)}%` }} />
      </div>
      {taux > 1 && (
        <p className="mt-2 text-sm text-red-300">Capacité dépassée de {formatPoids(poids - POIDS_MAX_KG)}.</p>
      )}
    </Card>
  )
}

function QuantiteEditeur({
  quantite,
  onAjuster,
  onDefinir,
}: {
  quantite: number
  onAjuster: (delta: number) => void
  onDefinir: (valeur: number) => void
}) {
  // Uniquement les chiffres saisis ; les espaces de milliers ne sont ajoutés qu'à l'affichage
  const [saisie, setSaisie] = useState(String(quantite))

  function valider() {
    if (saisie === '') setSaisie(String(quantite))
    else if (Number(saisie) !== quantite) onDefinir(Number(saisie))
  }

  const bouton = 'size-8 rounded-md border border-zinc-700 text-lg leading-none text-zinc-200 hover:bg-zinc-800 disabled:opacity-40'

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={bouton} aria-label="Retirer 1" disabled={quantite <= 0} onClick={() => onAjuster(-1)}>
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantité"
        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-base font-semibold text-zinc-50 tabular-nums focus:border-purple-500 focus:outline-none"
        value={saisie.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
        onChange={(e) => setSaisie(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={valider}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <button type="button" className={bouton} aria-label="Ajouter 1" onClick={() => onAjuster(1)}>
        +
      </button>
    </div>
  )
}
