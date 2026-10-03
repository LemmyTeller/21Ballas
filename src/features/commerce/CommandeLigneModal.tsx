import { useState, type FormEvent } from 'react'
import { ImageItem } from '../../components/ImageItem'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatPrix } from '../../lib/format'
import { formatDate } from '../../lib/roles'
import type { Commande, Partenaire, Reference, Tarif } from '../../types'
import { creerCommande, fusionnerLigne, lignesDe, majLignes, memeLigne } from './api'

const NOUVELLE = 'nouvelle'

// « 2 ventes, 1 achat »
function contenu(commande: Commande): string {
  const compte = (n: number, mot: string) => (n > 0 ? `${n} ${mot}${n > 1 ? 's' : ''}` : null)
  return [compte(lignesDe(commande, 'vente').length, 'vente'), compte(lignesDe(commande, 'achat').length, 'achat')]
    .filter(Boolean)
    .join(', ')
}

// Depuis une ligne de tarif : met l'item, avec une quantité, dans une commande.
// Si une commande est déjà en attente avec ce partenaire, on propose de la compléter : une même commande
// peut mêler des ventes et des achats.
export function CommandeLigneModal({
  partenaire,
  tarif,
  reference,
  commandes,
  creeParUid,
  onClose,
}: {
  partenaire: Partenaire
  tarif: Tarif
  reference: Reference | undefined
  commandes: Commande[]
  creeParUid: string
  onClose: () => void
}) {
  const vente = tarif.sens === 'vente'
  const enCours = commandes
    .filter((c) => c.statut === 'en_attente' && c.partenaireId === partenaire.id)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))

  const [quantite, setQuantite] = useState('1')
  // Par défaut on complète la commande en cours la plus récente
  const [cible, setCible] = useState(enCours[0]?.id ?? NOUVELLE)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const ligne = {
    reference: tarif.reference,
    sens: tarif.sens,
    quantite: Number(quantite),
    prixPropre: tarif.prixPropre,
    prixSale: tarif.prixSale,
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      const commande = enCours.find((c) => c.id === cible)
      if (commande) await majLignes(commande.id, fusionnerLigne(commande.lignes, ligne))
      else await creerCommande(partenaire, ligne, creeParUid)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  const choix = 'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm'
  const actif = 'border-purple-500 bg-purple-950/40'
  const inactif = 'border-zinc-800 hover:bg-zinc-800/50'

  return (
    <Modal title={vente ? `Vendre à ${partenaire.nom}` : `Acheter à ${partenaire.nom}`} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <div className="flex items-center gap-3">
          <ImageItem item={reference} dossier={reference?.dossier} />
          <div>
            <p className="font-medium text-zinc-100">{reference?.name ?? `Item ${tarif.reference}`}</p>
            <p className="text-xs text-zinc-500">
              Propre {formatPrix(tarif.prixPropre)} · Sale {formatPrix(tarif.prixSale)}
            </p>
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Quantité</span>
          <input
            type="number"
            className={inputClass}
            value={quantite}
            min={1}
            step={1}
            required
            autoFocus
            onChange={(e) => setQuantite(e.target.value)}
          />
        </label>

        {enCours.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-amber-200">
              Une commande est en cours avec {partenaire.nom}
            </legend>
            {enCours.map((c) => (
              <label key={c.id} className={`${choix} ${cible === c.id ? actif : inactif}`}>
                <input
                  type="radio"
                  name="cible"
                  className="mt-0.5 accent-purple-500"
                  checked={cible === c.id}
                  onChange={() => setCible(c.id)}
                />
                <span>
                  <span className="block font-medium text-zinc-100">
                    Ajouter {vente ? 'cette vente' : 'cet achat'} à la commande en cours
                  </span>
                  <span className="block text-xs text-zinc-400">
                    Du {formatDate(c.createdAt, true)} · {contenu(c)}
                    {c.lignes.some((l) => memeLigne(l, ligne)) && ' · contient déjà cet item, la quantité s’ajoute'}
                  </span>
                </span>
              </label>
            ))}
            <label className={`${choix} ${cible === NOUVELLE ? actif : inactif}`}>
              <input
                type="radio"
                name="cible"
                className="mt-0.5 accent-purple-500"
                checked={cible === NOUVELLE}
                onChange={() => setCible(NOUVELLE)}
              />
              <span className="font-medium text-zinc-100">Créer une nouvelle commande</span>
            </label>
          </fieldset>
        )}

        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !(Number(quantite) >= 1)}>
            {cible === NOUVELLE ? (vente ? 'Créer la vente' : 'Créer l’achat') : 'Ajouter à la commande'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
