import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatNombre, formatPrix } from '../../lib/format'
import type { Article, Commande, Lieu, Reference } from '../../types'
import { quantiteDans } from '../stock/useArticles'
import { entreesSaisie, lignesDe, montantAttendu, titreCommande, validerCommande, variationsStock, type Cloture } from './api'

interface ItemEchange {
  reference: Reference
  quantite: number
}

// Un côté du règlement : ce qu'on reçoit, ou ce qu'on donne
interface Reglement {
  propre: string
  sale: string
  items: ItemEchange[]
}

const montantSaisi = (valeur: string) => (valeur === '' ? null : Number(valeur))
const versEchanges = (items: ItemEchange[]) => items.map((i) => ({ reference: i.reference.cle, quantite: i.quantite }))

// Pré-rempli seulement quand une seule monnaie est possible ; sinon c'est au gradé de dire comment ça a été payé
function reglementInitial(attenduPropre: number | null, attenduSale: number | null): Reglement {
  return {
    propre: attenduPropre !== null && attenduSale === null ? String(attenduPropre) : '',
    sale: attenduSale !== null && attenduPropre === null ? String(attenduSale) : '',
    items: [],
  }
}

// Clôture d'une commande par un gradé : ce qui a réellement été reçu et donné (propre, sale, items),
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
  const ventes = lignesDe(commande, 'vente')
  const achats = lignesDe(commande, 'achat')
  const attendu = {
    recuPropre: montantAttendu(ventes, 'prixPropre'),
    recuSale: montantAttendu(ventes, 'prixSale'),
    payePropre: montantAttendu(achats, 'prixPropre'),
    payeSale: montantAttendu(achats, 'prixSale'),
  }

  const [recu, setRecu] = useState(() => reglementInitial(attendu.recuPropre, attendu.recuSale))
  const [paye, setPaye] = useState(() => reglementInitial(attendu.payePropre, attendu.payeSale))
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const cloture: Cloture = {
    recuPropre: montantSaisi(recu.propre),
    recuSale: montantSaisi(recu.sale),
    recuItems: versEchanges(recu.items),
    payePropre: montantSaisi(paye.propre),
    payeSale: montantSaisi(paye.sale),
    payeItems: versEchanges(paye.items),
    lieuId: lieuId || null,
    note,
  }
  const nom = (cle: string) => catalogue.find((r) => r.cle === cle)?.name ?? `Item ${cle}`
  const variations = [...variationsStock(commande, cloture)].map(([reference, delta]) => {
    const article = articles.find((a) => a.id === reference)
    const disponible = article && lieuId ? quantiteDans(article, lieuId) : 0
    return { reference, delta, disponible, insuffisant: delta < 0 && disponible < -delta }
  })

  const entrees = [...entreesSaisie(commande, cloture)]

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
    <Modal title={`Valider — ${titreCommande(commande)}`} onClose={onClose}>
      <form onSubmit={valider} className="space-y-4">
        <p className="text-sm text-zinc-400">
          Saisis ce qui a réellement changé de main, après négociation. Les montants et les items peuvent se combiner.
        </p>

        {/* Une vente fait rentrer quelque chose, un achat en fait sortir ; une commande mixte a les deux côtés */}
        {ventes.length > 0 && (
          <BlocReglement
            titre="Ce qu’on reçoit"
            libelleItems="Items repris en échange"
            attenduPropre={attendu.recuPropre}
            attenduSale={attendu.recuSale}
            reglement={recu}
            onChange={setRecu}
            catalogue={catalogue}
          />
        )}
        {achats.length > 0 && (
          <BlocReglement
            titre="Ce qu’on donne"
            libelleItems="Items donnés en échange"
            attenduPropre={attendu.payePropre}
            attenduSale={attendu.payeSale}
            reglement={paye}
            onChange={setPaye}
            catalogue={catalogue}
          />
        )}

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

        {entrees.length > 0 && (
          <p className="text-xs text-zinc-500">
            Ajouté à la saisie journalière :{' '}
            {entrees.map(([reference, quantite]) => `${formatNombre(quantite)} ${nom(reference)}`).join(', ')}.
          </p>
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

function BlocReglement({
  titre,
  libelleItems,
  attenduPropre,
  attenduSale,
  reglement,
  onChange,
  catalogue,
}: {
  titre: string
  libelleItems: string
  attenduPropre: number | null
  attenduSale: number | null
  reglement: Reglement
  onChange: (reglement: Reglement) => void
  catalogue: Reference[]
}) {
  const [ajout, setAjout] = useState(false)
  const [selection, setSelection] = useState<Reference | null>(null)
  const [quantite, setQuantite] = useState('1')

  function ajouterItem() {
    if (!selection || !(Number(quantite) >= 1)) return
    const present = reglement.items.some((i) => i.reference.cle === selection.cle)
    onChange({
      ...reglement,
      items: present
        ? reglement.items.map((i) =>
            i.reference.cle === selection.cle ? { ...i, quantite: i.quantite + Number(quantite) } : i,
          )
        : [...reglement.items, { reference: selection, quantite: Number(quantite) }],
    })
    setSelection(null)
    setQuantite('1')
    setAjout(false)
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-zinc-800 p-3">
      <legend className="px-1 text-sm font-medium text-zinc-100">{titre}</legend>
      <p className="text-xs text-zinc-500">
        Attendu : propre <span className="text-emerald-400">{formatPrix(attenduPropre)}</span>, sale{' '}
        <span className="text-amber-400">{formatPrix(attenduSale)}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">En propre ($)</span>
          <input
            type="number"
            className={inputClass}
            value={reglement.propre}
            min={0}
            step="any"
            onChange={(e) => onChange({ ...reglement, propre: e.target.value })}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">En sale ($)</span>
          <input
            type="number"
            className={inputClass}
            value={reglement.sale}
            min={0}
            step="any"
            onChange={(e) => onChange({ ...reglement, sale: e.target.value })}
          />
        </label>
      </div>

      <p className="pt-1 text-sm text-zinc-400">{libelleItems}</p>
      {reglement.items.length > 0 && (
        <ul className="divide-y divide-zinc-800 text-sm">
          {reglement.items.map((item) => (
            <li key={item.reference.cle} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 text-zinc-100">{item.reference.name}</span>
              <span className="font-semibold text-zinc-100 tabular-nums">{formatNombre(item.quantite)}</span>
              <button
                type="button"
                aria-label={`Retirer ${item.reference.name}`}
                className="text-zinc-500 hover:text-red-300"
                onClick={() => onChange({ ...reglement, items: reglement.items.filter((i) => i !== item) })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {ajout ? (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <SelecteurReference catalogue={catalogue} selection={selection} onSelection={setSelection} />
          {selection && (
            <div className="flex items-end gap-2">
              <label className="block flex-1 space-y-1 text-sm">
                <span className="text-zinc-400">Quantité</span>
                <input
                  type="number"
                  className={inputClass}
                  value={quantite}
                  min={1}
                  step={1}
                  onChange={(e) => setQuantite(e.target.value)}
                />
              </label>
              <Button onClick={ajouterItem}>Ajouter</Button>
            </div>
          )}
          <Button variant="ghost" onClick={() => setAjout(false)}>
            Fermer
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setAjout(true)}>
          + Item
        </Button>
      )}
    </fieldset>
  )
}
