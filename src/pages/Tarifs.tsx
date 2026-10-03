import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageItem } from '../components/ImageItem'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { CommandeLigneModal } from '../features/commerce/CommandeLigneModal'
import { useCommandes } from '../features/commerce/useCommandes'
import { TYPE_LABELS } from '../features/tarifs/api'
import { PartenaireModal } from '../features/tarifs/PartenaireModal'
import { TarifModal } from '../features/tarifs/TarifModal'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { useTarifs } from '../features/tarifs/useTarifs'
import { useLieux } from '../features/gestion/useLieux'
import { quantiteDans, useArticles } from '../features/stock/useArticles'
import { formatNombre, formatPrix } from '../lib/format'
import { aAuMoins } from '../lib/roles'
import { useReferences } from '../lib/useCatalogue'
import type { Partenaire, Reference, SensTarif, Tarif, TypePartenaire } from '../types'

type Fenetre =
  | { type: 'partenaire'; partenaire?: Partenaire }
  | { type: 'tarif'; sens: SensTarif; tarif?: Tarif }
  | { type: 'commande'; tarif: Tarif }

const SENS: { sens: SensTarif; titre: string }[] = [
  { sens: 'achat', titre: 'On lui achète' },
  { sens: 'vente', titre: 'On lui vend' },
]

// Total des valeurs renseignées ; null si aucune ligne n'a de prix dans cette monnaie
function somme(valeurs: (number | null)[]): number | null {
  const connues = valeurs.filter((v) => v !== null)
  return connues.length === 0 ? null : connues.reduce((total, v) => total + v, 0)
}

// Valeur en propre (vert) et en sale (orange), l'une sous l'autre ; seules les monnaies renseignées apparaissent
function Valeurs({ propre, sale }: { propre: number | null; sale: number | null }) {
  if (propre === null && sale === null) return <span className="text-zinc-600">—</span>
  return (
    <div className="font-semibold whitespace-nowrap tabular-nums">
      {propre !== null && <p className="text-emerald-400">{formatPrix(propre)}</p>}
      {sale !== null && <p className="text-amber-400">{formatPrix(sale)}</p>}
    </div>
  )
}

export function Tarifs() {
  const moi = useMembre()
  const partenaires = usePartenaires()
  const tarifs = useTarifs()
  const catalogue = useReferences()
  // Stock du groupe, pour chiffrer ce qu'il peut vendre
  const articles = useArticles()
  const lieux = useLieux()
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)
  // Menu « ⋯ » d'une ligne, ancré sous son bouton
  const [menu, setMenu] = useState<{ tarif: Tarif; droite: number; haut: number } | null>(null)
  // Pour proposer de compléter une vente ou un achat déjà en cours avec le partenaire
  const commandes = useCommandes()

  const estGrade = aAuMoins(moi.role, 'n2')
  const chargement = partenaires.loading || tarifs.loading || articles.loading || lieux.loading || !catalogue.items

  const tries = [...partenaires.data].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  // Sans choix explicite (ou si le partenaire choisi vient d'être supprimé), le premier groupe, sinon la première PM
  const selection =
    tries.find((p) => p.id === selectionId) ?? tries.find((p) => p.type === 'groupe') ?? tries[0] ?? null

  const reference = (tarif: Tarif): Reference | undefined => catalogue.items?.find((r) => r.cle === tarif.reference)
  const nom = (tarif: Tarif) => reference(tarif)?.name ?? `Item ${tarif.reference}`

  // Quantité en stock de l'item, tous lieux confondus (le total de l'onglet Global du Stock)
  function stock(tarif: Tarif): number {
    const article = articles.data.find((a) => a.id === tarif.reference)
    return article ? lieux.data.reduce((total, l) => total + quantiteDans(article, l.id), 0) : 0
  }
  // Ce que rapporterait la vente de tout le stock à ce prix ; null si le prix n'est pas renseigné
  const valeur = (tarif: Tarif, prix: number | null) => (prix === null ? null : stock(tarif) * prix)

  function liste(type: TypePartenaire, titre: string) {
    const membres = tries.filter((p) => p.type === type)
    return (
      <div>
        <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">{titre}</p>
        {membres.length === 0 ? (
          <p className="px-2 py-1 text-sm text-zinc-600">Aucun</p>
        ) : (
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {membres.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap transition-colors ${
                    selection?.id === p.id ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                  onClick={() => setSelectionId(p.id)}
                >
                  {p.nom}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Tarifs</h1>
          <p className="text-sm text-zinc-400">
            Ce qu’on achète et ce qu’on vend à chaque groupe et petite main, en propre ou en sale (billets de 1$).
          </p>
        </div>
        {estGrade && <Button onClick={() => setFenetre({ type: 'partenaire' })}>+ Partenaire</Button>}
      </header>

      <ErrorMessage>
        {partenaires.error ?? tarifs.error ?? articles.error ?? lieux.error ?? catalogue.erreur}
      </ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : tries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aucun partenaire pour le moment.{estGrade && ' Commence par en créer un avec « + Partenaire ».'}
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <Card className="space-y-4 p-4!">
            {liste('groupe', 'Groupes')}
            {liste('pm', 'Petites mains')}
          </Card>

          {selection && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-semibold text-zinc-50">{selection.nom}</span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                      {TYPE_LABELS[selection.type]}
                    </span>
                  </p>
                  {selection.telephone && <p className="text-sm text-zinc-400">Tél. {selection.telephone}</p>}
                  {selection.note && <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-400">{selection.note}</p>}
                </div>
                {estGrade && (
                  <Button variant="ghost" onClick={() => setFenetre({ type: 'partenaire', partenaire: selection })}>
                    Modifier
                  </Button>
                )}
              </div>

              <div className="grid items-start gap-6 xl:grid-cols-2">
                {SENS.map(({ sens, titre }) => {
                  const lignes = tarifs.data
                    .filter((t) => t.partenaireId === selection.id && t.sens === sens)
                    // Dans l'ordre d'ajout ; une ligne tout juste créée (heure pas encore confirmée) va en dernier
                    .sort((a, b) => (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity))
                  return (
                    <Card
                      key={sens}
                      title={titre}
                      action={estGrade && <Button onClick={() => setFenetre({ type: 'tarif', sens })}>+ Ligne</Button>}
                    >
                      {lignes.length === 0 ? (
                        <p className="text-sm text-zinc-600">Rien pour le moment.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-xs tracking-wide text-zinc-500 uppercase">
                              <tr>
                                <th className="pb-2 font-medium" colSpan={2}>
                                  Item
                                </th>
                                <th className="pb-2 text-right font-medium">Propre</th>
                                <th className="pb-2 text-right font-medium">Sale</th>
                                {sens === 'vente' && (
                                  <>
                                    <th className="pb-2 pl-3 text-right font-medium">Stock</th>
                                    <th className="pb-2 pl-3 text-right font-medium">Valeur totale</th>
                                  </>
                                )}
                                <th className="pb-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                              {lignes.map((tarif) => (
                                <tr key={tarif.id}>
                                  <td className="w-12 py-2 pr-3">
                                    <ImageItem item={reference(tarif)} dossier={reference(tarif)?.dossier} />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <p className="font-medium text-zinc-100">{nom(tarif)}</p>
                                    {tarif.note && <p className="text-xs text-zinc-500">{tarif.note}</p>}
                                  </td>
                                  <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap text-emerald-400 tabular-nums">
                                    {formatPrix(tarif.prixPropre)}
                                  </td>
                                  <td className="py-2 text-right font-semibold whitespace-nowrap text-amber-400 tabular-nums">
                                    {formatPrix(tarif.prixSale)}
                                  </td>
                                  {sens === 'vente' && (
                                    <>
                                      <td className="py-2 pl-3 text-right whitespace-nowrap text-zinc-200 tabular-nums">
                                        {formatNombre(stock(tarif))}
                                      </td>
                                      <td className="py-2 pl-3 text-right">
                                        <Valeurs propre={valeur(tarif, tarif.prixPropre)} sale={valeur(tarif, tarif.prixSale)} />
                                      </td>
                                    </>
                                  )}
                                  <td className="w-8 py-2 pl-2 text-right">
                                    <button
                                      type="button"
                                      aria-label={`Actions pour ${nom(tarif)}`}
                                      aria-haspopup="menu"
                                      title="Actions"
                                      className="flex size-7 items-center justify-center rounded-md text-lg leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                      onClick={(e) => {
                                        const cadre = e.currentTarget.getBoundingClientRect()
                                        setMenu({ tarif, droite: window.innerWidth - cadre.right, haut: cadre.bottom + 4 })
                                      }}
                                    >
                                      ⋯
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            {sens === 'vente' && (
                              <tfoot>
                                <tr className="border-t border-zinc-700">
                                  <td colSpan={5} className="pt-3 text-xs tracking-wide text-zinc-500 uppercase">
                                    Valeur totale du stock vendable
                                  </td>
                                  <td className="pt-3 pl-3 text-right">
                                    <Valeurs
                                      propre={somme(lignes.map((t) => valeur(t, t.prixPropre)))}
                                      sale={somme(lignes.map((t) => valeur(t, t.prixSale)))}
                                    />
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {menu && (
        <>
          {/* Fond invisible : un clic ailleurs referme le menu */}
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenu(null)}
          />
          <div
            role="menu"
            className="fixed z-20 min-w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl"
            style={{ right: menu.droite, top: menu.haut }}
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                setFenetre({ type: 'commande', tarif: menu.tarif })
                setMenu(null)
              }}
            >
              {menu.tarif.sens === 'vente' ? 'Créer une vente' : 'Créer un achat'}
            </button>
            {estGrade && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  setFenetre({ type: 'tarif', sens: menu.tarif.sens, tarif: menu.tarif })
                  setMenu(null)
                }}
              >
                Modifier le tarif
              </button>
            )}
          </div>
        </>
      )}

      {fenetre?.type === 'commande' && selection && (
        <CommandeLigneModal
          partenaire={selection}
          tarif={fenetre.tarif}
          reference={reference(fenetre.tarif)}
          commandes={commandes.data}
          creeParUid={moi.uid}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'partenaire' && (
        <PartenaireModal
          partenaire={fenetre.partenaire}
          tarifs={tarifs.data}
          onCree={setSelectionId}
          onClose={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === 'tarif' && selection && catalogue.items && (
        <TarifModal
          partenaire={selection}
          sens={fenetre.sens}
          tarif={fenetre.tarif}
          catalogue={catalogue.items}
          tarifs={tarifs.data}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}
