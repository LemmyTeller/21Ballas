import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { ImageItem } from '../components/ImageItem'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { annulerCommande, lignesDe, majLignes, montantAttendu, titreCommande } from '../features/commerce/api'
import { useCommandes } from '../features/commerce/useCommandes'
import { ValidationModal } from '../features/commerce/ValidationModal'
import { useLieux } from '../features/gestion/useLieux'
import { useMembres } from '../features/members/useMembres'
import { useArticles } from '../features/stock/useArticles'
import { formatNombre, formatPrix } from '../lib/format'
import { aAuMoins, formatDate, nomAffiche } from '../lib/roles'
import { useReferences } from '../lib/useCatalogue'
import type { Commande, Echange, LigneCommande, StatutCommande } from '../types'

type Vue = 'en_cours' | 'historique'

const HISTORIQUE_MAX = 50

const STATUTS: Record<StatutCommande, { label: string; classe: string }> = {
  en_attente: { label: 'En attente', classe: 'bg-amber-950 text-amber-200' },
  validee: { label: 'Validée', classe: 'bg-emerald-950 text-emerald-300' },
  annulee: { label: 'Annulée', classe: 'bg-zinc-800 text-zinc-400' },
}

const millis = (c: Commande, champ: 'createdAt' | 'clotureAt') => c[champ]?.toMillis() ?? Infinity

// Un côté du règlement final d'une commande validée : argent propre, argent sale, items
function Reglement({
  titre,
  propre,
  sale,
  items = [],
  nomItem,
}: {
  titre: string
  propre: number | null | undefined
  sale: number | null | undefined
  items: Echange[] | undefined
  nomItem: (cle: string) => string
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-400">{titre}</dt>
      <dd className="text-right font-semibold tabular-nums">
        <span className="text-emerald-400">{formatPrix(propre)}</span> <span className="font-normal">propre</span> ·{' '}
        <span className="text-amber-400">{formatPrix(sale)}</span> <span className="font-normal">sale</span>
        {items.length > 0 && (
          <span className="block font-normal text-zinc-100">
            {items.map((i) => `${formatNombre(i.quantite)} × ${nomItem(i.reference)}`).join(', ')}
          </span>
        )}
      </dd>
    </div>
  )
}

export function Commerce() {
  const moi = useMembre()
  const commandes = useCommandes()
  const membres = useMembres()
  const lieux = useLieux()
  const articles = useArticles()
  const catalogue = useReferences()
  const [vue, setVue] = useState<Vue>('en_cours')
  const [aValider, setAValider] = useState<Commande | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)

  const estGrade = aAuMoins(moi, 'n2')
  const chargement =
    commandes.loading || membres.loading || lieux.loading || articles.loading || !catalogue.items

  const enCours = commandes.data
    .filter((c) => c.statut === 'en_attente')
    .sort((a, b) => millis(a, 'createdAt') - millis(b, 'createdAt'))
  const historique = commandes.data
    .filter((c) => c.statut !== 'en_attente')
    .sort((a, b) => millis(b, 'clotureAt') - millis(a, 'clotureAt'))
    .slice(0, HISTORIQUE_MAX)
  const affichees = vue === 'en_cours' ? enCours : historique

  const reference = (cle: string) => catalogue.items?.find((r) => r.cle === cle)
  const nomItem = (cle: string) => reference(cle)?.name ?? `Item ${cle}`
  const nomMembre = (uid: string | undefined) => nomAffiche(membres.data.find((m) => m.uid === uid))

  const agir = (action: Promise<void>) => {
    setErreurAction(null)
    action.catch((e: Error) => setErreurAction(e.message))
  }

  function retirerLigne(commande: Commande, ligne: LigneCommande) {
    if (window.confirm(`Retirer ${nomItem(ligne.reference)} de la commande ?`)) {
      agir(majLignes(commande.id, commande.lignes.filter((l) => l !== ligne)))
    }
  }

  function annuler(commande: Commande) {
    if (window.confirm(`Annuler la commande « ${titreCommande(commande)} » ? Le stock ne sera pas modifié.`)) {
      agir(annulerCommande(commande.id, moi.uid))
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Commerce</h1>
          <p className="text-sm text-zinc-400">
            Ventes et achats avec les groupes et petites mains. Une commande se crée depuis l’onglet Tarifs.
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 p-0.5">
          {(['en_cours', 'historique'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                vue === v ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
              onClick={() => setVue(v)}
            >
              {v === 'en_cours' ? `En cours (${enCours.length})` : 'Historique'}
            </button>
          ))}
        </div>
      </header>

      <ErrorMessage>
        {commandes.error ?? membres.error ?? lieux.error ?? articles.error ?? catalogue.erreur ?? erreurAction}
      </ErrorMessage>

      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : affichees.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {vue === 'en_cours' ? 'Aucune vente ni achat en cours.' : 'Aucune commande validée ou annulée pour le moment.'}
        </p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          {affichees.map((commande) => {
            const enAttente = commande.statut === 'en_attente'
            const statut = STATUTS[commande.statut]
            return (
              <Card
                key={commande.id}
                title={titreCommande(commande)}
                action={
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statut.classe}`}>
                    {statut.label}
                  </span>
                }
              >
                <p className="-mt-2 mb-3 text-xs text-zinc-500">
                  Créée le {formatDate(commande.createdAt, true)} par {nomMembre(commande.creeParUid)}
                  {!enAttente && (
                    <>
                      {' '}
                      · {commande.statut === 'validee' ? 'validée' : 'annulée'} le {formatDate(commande.clotureAt, true)} par{' '}
                      {nomMembre(commande.clotureParUid)}
                    </>
                  )}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs tracking-wide text-zinc-500 uppercase">
                      <tr>
                        <th className="pb-2 font-medium" colSpan={2}>
                          Item
                        </th>
                        <th className="pb-2 text-right font-medium">Qté</th>
                        <th className="pb-2 pl-3 text-right font-medium">Propre</th>
                        <th className="pb-2 pl-3 text-right font-medium">Sale</th>
                        {enAttente && <th className="pb-2" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {/* Les ventes d'abord, puis les achats */}
                      {[...lignesDe(commande, 'vente'), ...lignesDe(commande, 'achat')].map((ligne) => (
                        <tr key={`${ligne.sens}-${ligne.reference}`}>
                          <td className="w-12 py-2 pr-3">
                            <ImageItem item={reference(ligne.reference)} dossier={reference(ligne.reference)?.dossier} />
                          </td>
                          <td className="py-2 pr-3">
                            <p className="font-medium text-zinc-100">{nomItem(ligne.reference)}</p>
                            <p className={`text-xs ${ligne.sens === 'vente' ? 'text-purple-300' : 'text-sky-300'}`}>
                              {ligne.sens === 'vente' ? 'On vend' : 'On achète'}
                            </p>
                          </td>
                          <td className="py-2 text-right font-semibold text-zinc-100 tabular-nums">
                            {formatNombre(ligne.quantite)}
                          </td>
                          <td className="py-2 pl-3 text-right whitespace-nowrap text-emerald-400 tabular-nums">
                            {formatPrix(ligne.prixPropre === null ? null : ligne.quantite * ligne.prixPropre)}
                          </td>
                          <td className="py-2 pl-3 text-right whitespace-nowrap text-amber-400 tabular-nums">
                            {formatPrix(ligne.prixSale === null ? null : ligne.quantite * ligne.prixSale)}
                          </td>
                          {enAttente && (
                            <td className="py-2 pl-2 text-right">
                              {/* La dernière ligne ne se retire pas : une commande vide s'annule */}
                              {commande.lignes.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Retirer ${nomItem(ligne.reference)}`}
                                  title="Retirer la ligne"
                                  className="text-zinc-500 hover:text-red-300"
                                  onClick={() => retirerLigne(commande, ligne)}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-zinc-700">
                      {(['vente', 'achat'] as const)
                        .filter((sens) => lignesDe(commande, sens).length > 0)
                        .map((sens) => (
                          <tr key={sens} className="font-semibold">
                            <td colSpan={3} className="pt-2 text-xs font-normal tracking-wide text-zinc-500 uppercase">
                              {sens === 'vente' ? 'À recevoir (ventes)' : 'À payer (achats)'}
                            </td>
                            <td className="pt-2 pl-3 text-right whitespace-nowrap text-emerald-400 tabular-nums">
                              {formatPrix(montantAttendu(lignesDe(commande, sens), 'prixPropre'))}
                            </td>
                            <td className="pt-2 pl-3 text-right whitespace-nowrap text-amber-400 tabular-nums">
                              {formatPrix(montantAttendu(lignesDe(commande, sens), 'prixSale'))}
                            </td>
                            {enAttente && <td />}
                          </tr>
                        ))}
                    </tfoot>
                  </table>
                </div>

                {commande.statut === 'validee' && (
                  <dl className="mt-4 space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
                    {lignesDe(commande, 'vente').length > 0 && (
                      <Reglement
                        titre="Reçu"
                        propre={commande.recuPropre}
                        sale={commande.recuSale}
                        items={commande.recuItems}
                        nomItem={nomItem}
                      />
                    )}
                    {lignesDe(commande, 'achat').length > 0 && (
                      <Reglement
                        titre="Donné"
                        propre={commande.payePropre}
                        sale={commande.payeSale}
                        items={commande.payeItems}
                        nomItem={nomItem}
                      />
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-400">Stock mis à jour</dt>
                      <dd className="text-zinc-100">
                        {commande.lieuId
                          ? (lieux.data.find((l) => l.id === commande.lieuId)?.nom ?? 'Lieu supprimé')
                          : 'Non'}
                      </dd>
                    </div>
                    {commande.note && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-zinc-400">Note</dt>
                        <dd className="text-right text-zinc-100">{commande.note}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {enAttente && estGrade && (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="danger" onClick={() => annuler(commande)}>
                      Annuler la commande
                    </Button>
                    <Button onClick={() => setAValider(commande)}>Valider</Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {aValider && catalogue.items && (
        <ValidationModal
          commande={aValider}
          lieux={lieux.data}
          articles={articles.data}
          catalogue={catalogue.items}
          acteurUid={moi.uid}
          onClose={() => setAValider(null)}
        />
      )}
    </>
  )
}
