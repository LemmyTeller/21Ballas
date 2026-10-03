import { useState } from 'react'
import { ImageItem } from '../components/ImageItem'
import { Card, Chargement, ErrorMessage, inputClass } from '../components/ui'
import { useArmes, useCatalogue } from '../lib/useCatalogue'
import type { Arme, Item } from '../types'

type Onglet = 'items' | 'armes'

const poids = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

export function Inventaire() {
  const [onglet, setOnglet] = useState<Onglet>('items')

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Inventaire</h1>
        <p className="text-sm text-zinc-400">Catalogue des items et des armes du serveur</p>
      </header>

      <nav className="flex gap-1 border-b border-zinc-800">
        {(['items', 'armes'] as const).map((o) => (
          <button
            key={o}
            type="button"
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              onglet === o ? 'border-purple-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-100'
            }`}
            onClick={() => setOnglet(o)}
          >
            {o === 'items' ? 'Items' : 'Armes'}
          </button>
        ))}
      </nav>

      {/* Chaque onglet garde sa propre recherche et ne charge son catalogue qu'à l'ouverture */}
      {onglet === 'items' ? <Items /> : <Armes />}
    </>
  )
}

function Items() {
  const { items, erreur } = useCatalogue()
  return <Catalogue lignes={items} erreur={erreur} dossier="items" libelle="item" />
}

function Armes() {
  const { items, erreur } = useArmes()
  return <Catalogue lignes={items} erreur={erreur} dossier="weapons" libelle="arme" />
}

function Catalogue({
  lignes,
  erreur,
  dossier,
  libelle,
}: {
  lignes: (Item | Arme)[] | null
  erreur: string | null
  dossier: 'items' | 'weapons'
  libelle: string
}) {
  const [recherche, setRecherche] = useState('')

  const terme = recherche.trim().toLocaleLowerCase('fr')
  const categorie = (ligne: Item | Arme) => ('category' in ligne ? ligne.category : '')
  const visibles =
    lignes?.filter((l) => `${l.name} ${categorie(l)}`.toLocaleLowerCase('fr').includes(terme)) ?? []
  const avecCategorie = lignes?.some((l) => 'category' in l) ?? false

  return (
    <>
      <ErrorMessage>{erreur}</ErrorMessage>
      <Card>
        {!lignes ? (
          !erreur && <Chargement />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                className={`${inputClass} max-w-sm`}
                placeholder={avecCategorie ? `Rechercher une ${libelle} ou une catégorie` : `Rechercher un ${libelle}`}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <span className="text-sm text-zinc-500">
                {visibles.length} {libelle}
                {visibles.length > 1 ? 's' : ''} sur {lignes.length}
              </span>
            </div>
            {visibles.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun résultat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="w-16 pb-2 font-medium">Image</th>
                      <th className="pb-2 font-medium">Nom</th>
                      {avecCategorie && <th className="pb-2 font-medium">Catégorie</th>}
                      <th className="pb-2 text-right font-medium">Poids</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {visibles.map((ligne) => (
                      <tr key={ligne.id}>
                        <td className="py-2 pr-4">
                          <ImageItem item={ligne} dossier={dossier} />
                        </td>
                        <td className="py-2 pr-4 font-medium text-zinc-100">{ligne.name}</td>
                        {avecCategorie && <td className="py-2 pr-4 text-zinc-300">{categorie(ligne)}</td>}
                        <td className="py-2 text-right text-zinc-300 tabular-nums">{poids.format(ligne.weight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  )
}
