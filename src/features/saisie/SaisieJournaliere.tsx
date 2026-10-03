import { useState, type FormEvent } from 'react'
import { ImageItem } from '../../components/ImageItem'
import { Modal } from '../../components/Modal'
import { SelecteurReference } from '../../components/SelecteurReference'
import { Button, Card, Chargement, ErrorMessage, inputClass } from '../../components/ui'
import { formatNombre } from '../../lib/format'
import { formatJour, jourDeSaisie } from '../../lib/journee'
import { useMaintenant } from '../../lib/presence'
import { useReferences } from '../../lib/useCatalogue'
import type { Reference, Saisie } from '../../types'
import { useLieux } from '../gestion/useLieux'
import { useArticles } from '../stock/useArticles'
import { ajouterSaisie } from './api'
import { useSaisies } from './useSaisies'

const HISTORIQUE_MAX = 30

// Butin du jour : chaque ajout monte le stock du lieu choisi et reste affiché jusqu'à la bascule de 3 h du matin.
// Les journées passées se consultent dans l'historique.
export function SaisieJournaliere() {
  const saisies = useSaisies()
  const lieux = useLieux()
  const articles = useArticles()
  const catalogue = useReferences()
  // Réévalué chaque minute : la saisie repart de zéro toute seule à 3 h
  const jour = jourDeSaisie(useMaintenant())

  const [lieuChoisi, setLieuChoisi] = useState('')
  const [nouvelItem, setNouvelItem] = useState(false)
  const [selection, setSelection] = useState<Reference | null>(null)
  const [quantite, setQuantite] = useState('')
  const [historique, setHistorique] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Le premier lieu (le QG) par défaut
  const lieuId = lieux.data.some((l) => l.id === lieuChoisi) ? lieuChoisi : (lieux.data[0]?.id ?? '')
  const chargement = saisies.loading || lieux.loading || articles.loading || !catalogue.items

  const reference = (cle: string) => catalogue.items?.find((r) => r.cle === cle)
  const nom = (cle: string) => reference(cle)?.name ?? `Item ${cle}`
  const lignes = (saisie: Saisie | undefined) =>
    Object.entries(saisie?.quantites ?? {})
      .filter(([, total]) => total !== 0)
      .sort(([a], [b]) => nom(a).localeCompare(nom(b), 'fr'))

  const duJour = lignes(saisies.data.find((s) => s.id === jour))
  const passees = saisies.data
    .filter((s) => s.id < jour && lignes(s).length > 0)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, HISTORIQUE_MAX)

  function ajouter(cle: string, valeur: string, apres?: () => void) {
    const nombre = Math.trunc(Number(valeur))
    if (!lieuId || !nombre) return
    setErreur(null)
    ajouterSaisie(jour, cle, nombre, lieuId, articles.data.find((a) => a.id === cle))
      .then(apres)
      .catch((e: Error) => setErreur(e.message))
  }

  function ajouterNouvelItem(e: FormEvent) {
    e.preventDefault()
    if (!selection) return
    ajouter(selection.cle, quantite, () => {
      setSelection(null)
      setQuantite('')
      setNouvelItem(false)
    })
  }

  return (
    <Card
      title="Saisie journalière"
      action={
        <Button variant="ghost" onClick={() => setHistorique(true)}>
          Historique
        </Button>
      }
    >
      <ErrorMessage>{saisies.error ?? lieux.error ?? articles.error ?? catalogue.erreur ?? erreur}</ErrorMessage>
      {chargement ? (
        !catalogue.erreur && <Chargement />
      ) : lieux.data.length === 0 ? (
        <p className="text-sm text-zinc-500">Crée d’abord un lieu de stockage dans l’onglet Gestion, vue Garages.</p>
      ) : (
        <div className="space-y-3">
          {/* Lieu de stockage et ajout d'un item sur une seule ligne */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap text-zinc-400">Butin stocké dans</span>
              <select
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none"
                value={lieuId}
                onChange={(e) => setLieuChoisi(e.target.value)}
              >
                {lieux.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
              </select>
            </label>
            {!nouvelItem && (
              <Button className="ml-auto" onClick={() => setNouvelItem(true)}>
                + Item
              </Button>
            )}
          </div>

          {duJour.length === 0 ? (
            <p className="text-sm text-zinc-500">Rien de saisi aujourd’hui. La saisie repart de zéro chaque jour à 3 h.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {duJour.map(([cle, total]) => (
                <li key={cle} className="flex items-center gap-3 py-2">
                  <ImageItem item={reference(cle)} dossier={reference(cle)?.dossier} />
                  <p className="min-w-0 flex-1 text-sm leading-tight font-medium text-zinc-100">{nom(cle)}</p>
                  <span className="text-base font-semibold text-zinc-50 tabular-nums">{formatNombre(total)}</span>
                  <AjoutRapide nom={nom(cle)} onAjouter={(valeur, apres) => ajouter(cle, valeur, apres)} />
                </li>
              ))}
            </ul>
          )}

          {nouvelItem && (
            <form onSubmit={ajouterNouvelItem} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <SelecteurReference catalogue={catalogue.items ?? []} selection={selection} onSelection={setSelection} />
              {selection && (
                <div className="flex items-end gap-2">
                  <label className="block flex-1 space-y-1 text-sm">
                    <span className="text-zinc-400">Quantité</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={quantite}
                      step={1}
                      required
                      autoFocus
                      onChange={(e) => setQuantite(e.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={!Math.trunc(Number(quantite))}>
                    Ajouter
                  </Button>
                </div>
              )}
              <Button variant="ghost" onClick={() => setNouvelItem(false)}>
                Fermer
              </Button>
            </form>
          )}
        </div>
      )}

      {historique && (
        <Modal title="Historique des saisies" onClose={() => setHistorique(false)}>
          {passees.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune journée enregistrée pour le moment.</p>
          ) : (
            <div className="max-h-[60svh] space-y-4 overflow-y-auto pr-1">
              {passees.map((saisie) => (
                <section key={saisie.id}>
                  <h3 className="text-sm font-semibold text-zinc-100 first-letter:uppercase">{formatJour(saisie.id)}</h3>
                  <ul className="mt-1 divide-y divide-zinc-800 text-sm">
                    {lignes(saisie).map(([cle, total]) => (
                      <li key={cle} className="flex justify-between gap-3 py-1">
                        <span className="text-zinc-300">{nom(cle)}</span>
                        <span className="font-semibold text-zinc-100 tabular-nums">{formatNombre(total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setHistorique(false)}>
              Fermer
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}

// Sur un item déjà saisi dans la journée : on n'entre que la quantité à ajouter
function AjoutRapide({ nom, onAjouter }: { nom: string; onAjouter: (valeur: string, apres: () => void) => void }) {
  const [valeur, setValeur] = useState('')

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        onAjouter(valeur, () => setValeur(''))
      }}
    >
      <input
        type="number"
        aria-label={`Quantité à ajouter pour ${nom}`}
        placeholder="+ qté"
        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-sm text-zinc-100 tabular-nums placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
        value={valeur}
        step={1}
        onChange={(e) => setValeur(e.target.value)}
      />
      <button
        type="submit"
        aria-label={`Ajouter à ${nom}`}
        title="Ajouter"
        disabled={!Math.trunc(Number(valeur))}
        className="size-8 rounded-md bg-purple-700 text-lg leading-none text-white hover:bg-purple-600 disabled:opacity-40"
      >
        +
      </button>
    </form>
  )
}
