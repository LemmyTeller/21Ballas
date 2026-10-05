import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Article, Carjacking, Lieu } from '../../types'
import { cloturerCarjacking } from './api'

// Clôture d'une voiture déposée : rachetée ou non ; si oui, montant en sale et lieu où entrent les billets de 1$
export function RachatModal({
  carjacking,
  lieux,
  articles,
  acteurUid,
  onClose,
}: {
  carjacking: Carjacking
  lieux: Lieu[]
  articles: Article[]
  acteurUid: string
  onClose: () => void
}) {
  const [rachete, setRachete] = useState(true)
  const [montant, setMontant] = useState('')
  const [lieuId, setLieuId] = useState(lieux[0]?.id ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function cloturer(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await cloturerCarjacking(
        carjacking.id,
        rachete
          ? { rachete: true, montant: Number(montant), lieuId: lieuId || null }
          : { rachete: false, montant: null, lieuId: null },
        acteurUid,
        articles,
      )
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  const choix = 'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm'
  const actif = 'border-purple-500 bg-purple-950/40'
  const inactif = 'border-zinc-800 hover:bg-zinc-800/50'

  return (
    <Modal title={`Rachat — ${carjacking.modele}`} onClose={onClose}>
      <form onSubmit={cloturer} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className={`${choix} ${rachete ? actif : inactif}`}>
            <input
              type="radio"
              name="rachete"
              className="accent-purple-500"
              checked={rachete}
              onChange={() => setRachete(true)}
            />
            <span className="font-medium text-zinc-100">Rachetée</span>
          </label>
          <label className={`${choix} ${!rachete ? actif : inactif}`}>
            <input
              type="radio"
              name="rachete"
              className="accent-purple-500"
              checked={!rachete}
              onChange={() => setRachete(false)}
            />
            <span className="font-medium text-zinc-100">Non rachetée</span>
          </label>
        </div>

        {rachete && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Montant du rachat, en sale ($)</span>
              <input
                type="number"
                className={inputClass}
                value={montant}
                min={0}
                step={1}
                required
                autoFocus
                onChange={(e) => setMontant(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Les billets de 1$ entrent dans</span>
              <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
                {lieux.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nom}
                  </option>
                ))}
                <option value="">Ne pas toucher au stock</option>
              </select>
            </label>
          </>
        )}

        <p className="text-xs text-zinc-500">
          {rachete && 'Le montant s’ajoute à la saisie journalière. '}
          Une fois enregistrée, la fiche part dans l’historique et ne se modifie plus.
        </p>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || (rachete && montant === '')}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
