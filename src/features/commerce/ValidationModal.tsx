import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatNombre, formatPrix } from '../../lib/format'
import type { Article, Commande, Lieu, Reference } from '../../types'
import { quantiteDans } from '../stock/useArticles'
import { montantAttendu, validerCommande, variationsStock, type Cloture } from './api'

const montantSaisi = (valeur: string) => (valeur === '' ? null : Number(valeur))

// Clôture d'une commande par un gradé : ce qui a réellement été payé (propre, sale, items en échange)
// et le lieu dont le stock est mis à jour.
export function ValidationModal({
  commande,
  lieux,
  articles,
  catalogue,
  acteurUid,
  onClose,
}: {
  commande: Commande
  lieux: Lieu[]
  articles: Article[]
  catalogue: Reference[]
  acteurUid: string
  onClose: () => void
}) {
  const vente = commande.sens === 'vente'
  const attenduPropre = montantAttendu(commande.lignes, 'prixPropre')
  const attenduSale = montantAttendu(commande.lignes, 'prixSale')

  // Pré-rempli seulement quand une seule monnaie est possible ; sinon c'est au gradé de dire comment ça a été payé
  const [montantPropre, setMontantPropre] = useState(
    attenduPropre !== null && attenduSale === null ? String(attenduPropre) : '',
  )
  const [montantSale, setMontantSale] = useState(attenduSale !== null && attenduPropre === null ? String(attenduSale) : '')
  const [echanges, setEchanges] = useState<{ reference: Reference; quantite: number }[]>([])
  const [selection, setSelection] = useState<Reference | null>(null)
  const [quantiteEchange, setQuantiteEchange] = useState('1')
  const [ajoutEchange, setAjoutEchange] = useState(false)
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const cloture: Cloture = {
    montantPropre: montantSaisi(montantPropre),
    montantSale: montantSaisi(montantSale),
    echanges: echanges.map((e) => ({ reference: e.reference.cle, quantite: e.quantite })),
    lieuId: lieuId || null,
    note,
  }
  const nom = (cle: string) => catalogue.find((r) => r.cle === cle)?.name ?? `Item ${cle}`
  const variations = [...variationsStock(commande, cloture)].map(([reference, delta]) => {
    const article = articles.find((a) => a.id === reference)
    const disponible = article && lieuId ? quantiteDans(article, lieuId) : 0
    return { reference, delta, disponible, insuffisant: delta < 0 && disponible < -delta }
  })

  function ajouterEchange() {
    if (!selection || !(Number(quantiteEchange) >= 1)) return
    const quantite = Number(quantiteEchange)
    setEchanges((liste) =>
      liste.some((e) => e.reference.cle === selection.cle)
        ? liste.map((e) => (e.reference.cle === selection.cle ? { ...e, quantite: e.quantite + quantite } : e))
        : [...liste, { reference: selection, quantite }],
    )
    setSelection(null)
    setQuantiteEchange('1')
    setAjoutEchange(false)
  }

  async function valider(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await validerCommande(commande, cloture, acteurUid, articles)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title={`Valider ${vente ? 'la vente à' : 'l’achat à'} ${commande.partenaireNom}`} onClose={onClose}>
      <form onSubmit={valider} className="space-y-4">
        <div>
          <p className="text-sm text-zinc-400">
            Montant réellement {vente ? 'reçu' : 'payé'}, après négociation. Attendu : propre{' '}
            <span className="text-emerald-400">{formatPrix(attenduPropre)}</span>, sale{' '}
            <span className="text-amber-400">{formatPrix(attenduSale)}</span>.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">En propre ($)</span>
              <input
                type="number"
                className={inputClass}
                value={montantPropre}
                min={0}
                step="any"
                onChange={(e) => setMontantPropre(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">En sale ($)</span>
              <input
                type="number"
                className={inputClass}
                value={montantSale}
                min={0}
                step="any"
                onChange={(e) => setMontantSale(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">{vente ? 'Items repris en échange' : 'Items donnés en échange'}</p>
          {echanges.length > 0 && (
            <ul className="divide-y divide-zinc-800 text-sm">
              {echanges.map((e) => (
                <li key={e.reference.cle} className="flex items-center gap-3 py-1.5">
                  <span className="flex-1 text-zinc-100">{e.reference.name}</span>
                  <span className="font-semibold text-zinc-100 tabular-nums">{formatNombre(e.quantite)}</span>
                  <button
                    type="button"
                    aria-label={`Retirer ${e.reference.name}`}
                    className="text-zinc-500 hover:text-red-300"
                    onClick={() => setEchanges((liste) => liste.filter((x) => x !== e))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ajoutEchange ? (
            <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
              <SelecteurReference catalogue={catalogue} selection={selection} onSelection={setSelection} />
              {selection && (
                <div className="flex items-end gap-2">
                  <label className="block flex-1 space-y-1 text-sm">
                    <span className="text-zinc-400">Quantité</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={quantiteEchange}
                      min={1}
                      step={1}
                      onChange={(e) => setQuantiteEchange(e.target.value)}
                    />
                  </label>
                  <Button onClick={ajouterEchange}>Ajouter</Button>
                </div>
              )}
              <Button variant="ghost" onClick={() => setAjoutEchange(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setAjoutEchange(true)}>
              + Item
            </Button>
          )}
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Lieu dont le stock est mis à jour</span>
          <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
            <option value="">Ne pas toucher au stock</option>
          </select>
        </label>

        {lieuId && variations.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
            {variations.map((v) => (
              <li key={v.reference} className="flex items-baseline justify-between gap-3">
                <span className="text-zinc-300">{nom(v.reference)}</span>
                <span className={`font-semibold tabular-nums ${v.delta > 0 ? 'text-emerald-400' : 'text-red-300'}`}>
                  {v.delta > 0 ? '+' : '−'}
                  {formatNombre(Math.abs(v.delta))}
                  {v.insuffisant && (
                    <span className="ml-2 text-xs font-normal text-amber-300">
                      seulement {formatNombre(v.disponible)} dans ce lieu : le stock tombera à 0
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>

        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi}>
            Valider
          </Button>
        </div>
      </form>
    </Modal>
  )
}
