import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageItem } from '../components/ImageItem'
import { Modal } from '../components/Modal'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { CommandeLigneModal } from '../features/commerce/CommandeLigneModal'
import { useCommandes } from '../features/commerce/useCommandes'
import { useContacts } from '../features/annuaire/useContacts'
import {
  GRILLE_PM,
  ID_GRILLE_PM,
  TYPES_AVEC_GRILLE,
  TYPE_LABELS,
  TYPE_PLURIELS,
  comparerPartenaires,
} from '../features/tarifs/api'
import { PartenaireModal } from '../features/tarifs/PartenaireModal'
import { TuileCouleur } from '../features/tarifs/TuileCouleur'
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
  | { type: 'contacts' }

// Identifiant de partenaire d'une petite main issue de l'Annuaire : ce préfixe suivi de l'id du contact.
// C'est lui que portent ses commandes.
const PREFIXE_CONTACT = 'contact-'

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
  const [pmOuvert, setPmOuvert] = useState(false)
  // Menu « ⋯ » d'une ligne, ancré sous son bouton
  const [menu, setMenu] = useState<{ tarif: Tarif; droite: number; haut: number } | null>(null)
  // Pour proposer de compléter une vente ou un achat déjà en cours avec le partenaire
  const commandes = useCommandes()
  const contacts = useContacts()
  const contactsDe = (partenaire: Partenaire) =>
    contacts.data.filter((c) => c.partenaireId === partenaire.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const estGrade = aAuMoins(moi.role, 'n2')
  const chargement = partenaires.loading || tarifs.loading || articles.loading || lieux.loading || !catalogue.items

  // Seuls le Cartel et les groupes ont leur propre grille ; les petites mains partagent la grille commune
  const tries = partenaires.data.filter((p) => TYPES_AVEC_GRILLE.includes(p.type)).sort(comparerPartenaires)
  // Les petites mains sont des personnes : les contacts de l'Annuaire rattachés à une organisation de type
  // « Petite main » (par exemple « PM - Petites Mains »), une entrée par personne. Chacune est présentée comme un
  // partenaire pour pouvoir passer commande avec elle. Une organisation PM sans aucun contact apparaît telle quelle.
  const organisationsPM = partenaires.data.filter((p) => p.type === 'pm')
  const pms: Partenaire[] = [
    ...contacts.data
      .filter((c) => organisationsPM.some((o) => o.id === c.partenaireId))
      .map((c) => ({
        id: `${PREFIXE_CONTACT}${c.id}`,
        nom: c.nom,
        type: 'pm' as const,
        telephone: c.telephone,
        note: [c.role, c.informations].filter(Boolean).join(' — '),
        couleur: organisationsPM.find((o) => o.id === c.partenaireId)?.couleur,
        createdAt: null,
      })),
    ...organisationsPM.filter((o) => !contacts.data.some((c) => c.partenaireId === o.id)),
  ].sort(comparerPartenaires)
  // Sans choix explicite (ou si le partenaire choisi vient d'être supprimé) : le premier de la liste,
  // à défaut la grille des petites mains
  const selection =
    selectionId === ID_GRILLE_PM
      ? GRILLE_PM
      : ([...tries, ...pms].find((p) => p.id === selectionId) ?? tries[0] ?? GRILLE_PM)
  // « Tarif commun » sélectionné : la grille des petites mains, sans PM précise
  const grillePM = selection.id === ID_GRILLE_PM
  // Une petite main (ou le tarif commun) : c'est la grille commune qui s'affiche et se modifie
  const estPM = selection.type === 'pm'
  const grille = estPM ? GRILLE_PM : selection

  const reference = (tarif: Tarif): Reference | undefined => catalogue.items?.find((r) => r.cle === tarif.reference)
  const nom = (tarif: Tarif) => reference(tarif)?.name ?? `Item ${tarif.reference}`

  // Quantité en stock de l'item, tous lieux confondus (le total de l'onglet Global du Stock)
  function stock(tarif: Tarif): number {
    const article = articles.data.find((a) => a.id === tarif.reference)
    return article ? lieux.data.reduce((total, l) => total + quantiteDans(article, l.id), 0) : 0
  }
  // Ce que rapporterait la vente de tout le stock à ce prix ; null si le prix n'est pas renseigné
  const valeur = (tarif: Tarif, prix: number | null) => (prix === null ? null : stock(tarif) * prix)

  const classeEntree = (actif: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap transition-colors ${
      actif ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
    }`

  function entree(p: Partenaire) {
    return (
      <li key={p.id}>
        <button type="button" className={classeEntree(selection.id === p.id)} onClick={() => setSelectionId(p.id)}>
          <TuileCouleur partenaire={p} className="size-3" />
          {p.nom}
        </button>
      </li>
    )
  }

  function liste(type: TypePartenaire, titre: string) {
    const membres = tries.filter((p) => p.type === type)
    return (
      <div key={type}>
        <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">{titre}</p>
        {membres.length === 0 ? (
          <p className="px-2 py-1 text-sm text-zinc-600">—</p>
        ) : (
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">{membres.map(entree)}</ul>
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
            Ce qu’on achète et ce qu’on vend à chaque groupe et aux petites mains, en propre ou en sale (billets de 1$).
          </p>
        </div>
        {estGrade && <Button onClick={() => setFenetre({ type: 'partenaire' })}>+ Partenaire</Button>}
      </header>

      <ErrorMessage>
        {partenaires.error ?? tarifs.error ?? articles.error ?? lieux.error ?? catalogue.erreur}
      </ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <Card className="space-y-4 p-4!">
            {TYPES_AVEC_GRILLE.map((type) => liste(type, TYPE_PLURIELS[type]))}
            <div>
              {/* Section repliée par défaut : la liste des petites mains peut être longue */}
              <button
                type="button"
                aria-expanded={pmOuvert}
                className="mb-1 flex w-full items-center justify-between gap-2 rounded-md text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-300"
                onClick={() => setPmOuvert(!pmOuvert)}
              >
                <span>
                  {TYPE_PLURIELS.pm} <span className="tabular-nums">({pms.length})</span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`size-4 transition-transform ${pmOuvert ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {/* Toutes les petites mains ont la même grille : « Tarif commun » sert à la régler,
                  chaque personne à passer une vente ou un achat avec elle */}
              {pmOuvert && (
                <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  <li>
                    <button type="button" className={classeEntree(grillePM)} onClick={() => setSelectionId(ID_GRILLE_PM)}>
                      Tarif commun
                    </button>
                  </li>
                  {pms.map(entree)}
                </ul>
              )}
            </div>
          </Card>

          {
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2">
                    {!grillePM && <TuileCouleur partenaire={selection} className="size-5" />}
                    <span className="text-xl font-semibold text-zinc-50">{selection.nom}</span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                      {grillePM ? 'Tarif commun' : TYPE_LABELS[selection.type]}
                    </span>
                    {/* Téléphone du partenaire et contacts de l'Annuaire, regroupés dans une fenêtre */}
                    {(selection.telephone || contactsDe(selection).length > 0) && (
                      <button
                        type="button"
                        aria-label={`Contacts de ${selection.nom}`}
                        title="Contacts et téléphones"
                        className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                        onClick={() => setFenetre({ type: 'contacts' })}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="size-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {contactsDe(selection).length > 0 && contactsDe(selection).length}
                      </button>
                    )}
                  </p>
                  {selection.note && <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-400">{selection.note}</p>}
                  {estPM && (
                    <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                      {grillePM
                        ? 'Les mêmes tarifs pour toutes les petites mains.'
                        : 'Tarif commun à toutes les petites mains : le modifier ici le modifie pour toutes.'}{' '}
                      Un prix négocié avec l’une d’elles se corrige à la validation de la commande.
                    </p>
                  )}
                </div>
                {/* Une personne de l'Annuaire se modifie dans l'Annuaire */}
                {estGrade && !grillePM && !selection.id.startsWith(PREFIXE_CONTACT) && (
                  <Button variant="ghost" onClick={() => setFenetre({ type: 'partenaire', partenaire: selection })}>
                    Modifier
                  </Button>
                )}
              </div>

              <div className="grid items-start gap-6 xl:grid-cols-2">
                {SENS.map(({ sens, titre }) => {
                  const lignes = tarifs.data
                    .filter((t) => t.partenaireId === grille.id && t.sens === sens)
                    // Dans l'ordre d'ajout ; une ligne tout juste créée (heure pas encore confirmée) va en dernier
                    .sort((a, b) => (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity))
                  return (
                    <Card
                      key={sens}
                      title={grillePM ? titre.replace('lui', 'leur') : titre}
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
          }
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

      {fenetre?.type === 'contacts' && (
        <Modal title={`Contacts — ${selection.nom}`} onClose={() => setFenetre(null)}>
          {selection.telephone && (
            <p className="text-sm text-zinc-300">
              Téléphone :{' '}
              <span className="font-semibold text-zinc-50 tabular-nums">{selection.telephone}</span>
            </p>
          )}
          {contactsDe(selection).length === 0 ? (
            // Une petite main est elle-même un contact : rien d'autre à lister
            !selection.id.startsWith(PREFIXE_CONTACT) && (
              <p className="text-sm text-zinc-500">Aucun contact rattaché dans l’Annuaire.</p>
            )
          ) : (
            <ul className="max-h-[60svh] divide-y divide-zinc-800 overflow-y-auto">
              {contactsDe(selection).map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <p>
                      <span className="font-medium text-zinc-100">{c.nom}</span>
                      {c.role && <span className="text-zinc-500"> · {c.role}</span>}
                    </p>
                    <span className="font-semibold whitespace-nowrap text-zinc-50 tabular-nums">{c.telephone || '—'}</span>
                  </div>
                  {c.informations && <p className="mt-0.5 text-xs whitespace-pre-wrap text-zinc-400">{c.informations}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setFenetre(null)}>
              Fermer
            </Button>
          </div>
        </Modal>
      )}

      {fenetre?.type === 'commande' && (
        <CommandeLigneModal
          // Depuis « Tarif commun », il faut dire avec quelle petite main on traite ; depuis une PM, c'est elle
          partenaires={grillePM ? pms : [selection]}
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
      {fenetre?.type === 'tarif' && catalogue.items && (
        <TarifModal
          // Pour une petite main, la ligne va dans la grille commune
          partenaire={grille}
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
