import { useState, type FormEvent } from 'react'
import { ImageItem } from '../../components/ImageItem'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { formatPrix } from '../../lib/format'
import type { Partenaire, Reference, SensTarif, Tarif } from '../../types'
import { ID_GRILLE_PM, creerTarif, idTarif, majTarif, supprimerTarif } from './api'

const prixSaisi = (valeur: string) => (valeur === '' ? null : Number(valeur))
const texte = (prix: number | null | undefined) => (prix === null || prix === undefined ? '' : String(prix))

// Ajout (sans `tarif`) ou modification d'une ligne de la grille d'un partenaire
export function TarifModal({
  partenaire,
  sens,
  tarif,
  catalogue,
  tarifs,
  onClose,
}: {
  partenaire: Partenaire
  sens: SensTarif
  tarif?: Tarif
  catalogue: Reference[]
  tarifs: Tarif[]
  onClose: () => void
}) {
  const [reference, setReference] = useState<Reference | null>(
    tarif ? (catalogue.find((r) => r.cle === tarif.reference) ?? null) : null,
  )
  const [prixPropre, setPrixPropre] = useState(texte(tarif?.prixPropre))
  const [prixSale, setPrixSale] = useState(texte(tarif?.prixSale))
  const [note, setNote] = useState(tarif?.note ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // En ajout : l'item choisi figure peut-être déjà dans cette grille, auquel cas on met sa ligne à jour
  const existant =
    tarif ?? (reference ? tarifs.find((t) => t.id === idTarif(partenaire.id, sens, reference.cle)) : undefined)

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
    const saisie = { prixPropre: prixSaisi(prixPropre), prixSale: prixSaisi(prixSale), note }
    executer(async () => {
      if (existant) await majTarif(existant.id, saisie)
      else if (reference) await creerTarif(partenaire.id, sens, reference.cle, saisie)
    })
  }

  const cible = partenaire.id === ID_GRILLE_PM ? 'aux petites mains' : `à ${partenaire.nom}`
  const titre = sens === 'achat' ? `On achète ${cible}` : `On vend ${cible}`

  return (
    <Modal title={titre} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {tarif ? (
          <div className="flex items-center gap-3">
            <ImageItem item={reference ?? undefined} dossier={reference?.dossier} />
            <span className="font-medium text-zinc-100">{reference?.name ?? `Item ${tarif.reference}`}</span>
          </div>
        ) : (
          <SelecteurReference catalogue={catalogue} selection={reference} onSelection={setReference} />
        )}
        {(tarif || reference) && (
          <>
            {!tarif && existant && (
              <p className="rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-100">
                Cet item est déjà dans cette grille (propre {formatPrix(existant.prixPropre)}, sale{' '}
                {formatPrix(existant.prixSale)}). Enregistrer remplacera ses prix.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Prix en propre ($)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={prixPropre}
                  min={0}
                  step="any"
                  autoFocus={Boolean(tarif)}
                  onChange={(e) => setPrixPropre(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Prix en sale ($)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={prixSale}
                  min={0}
                  step="any"
                  onChange={(e) => setPrixSale(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">Chaque prix est facultatif. Le sale se paie en billets de 1$.</p>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Note (facultatif)</span>
              <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </label>
          </>
        )}
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {tarif && (
            <Button
              variant="danger"
              disabled={envoi}
              onClick={() => {
                if (window.confirm('Supprimer cette ligne de tarif ?')) executer(() => supprimerTarif(tarif.id))
              }}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || (!tarif && !reference)}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
