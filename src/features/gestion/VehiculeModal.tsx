import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SelecteurModele } from '../../components/SelecteurModele'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { nomAffiche } from '../../lib/roles'
import { useModelesVehicules } from '../../lib/useCatalogue'
import type { Lieu, Membre, Vehicule } from '../../types'
import { creerVehicule, majVehicule, supprimerVehicule } from './api'
import { lieuComplet, occupation } from './outils'

// Création (sans `vehicule`) ou modification. `proprietaires` n'est fourni qu'à l'admin, qui peut choisir à qui appartient le véhicule.
export function VehiculeModal({
  vehicule,
  proprietaireUid,
  proprietaires,
  lieux,
  vehicules,
  onClose,
}: {
  vehicule?: Vehicule
  proprietaireUid: string
  proprietaires?: Membre[]
  lieux: Lieu[]
  vehicules: Vehicule[]
  onClose: () => void
}) {
  const catalogue = useModelesVehicules()
  const [modele, setModele] = useState(vehicule?.modele ?? '')
  const [spawn, setSpawn] = useState(vehicule?.spawn ?? null)
  const [plaque, setPlaque] = useState(vehicule?.plaque ?? '')
  const [proprietaire, setProprietaire] = useState(vehicule?.proprietaireUid ?? proprietaireUid)
  const [lieuId, setLieuId] = useState(vehicule?.lieuId ?? '')
  const [note, setNote] = useState(vehicule?.note ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

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
    const lieu = lieux.find((l) => l.id === lieuId)
    if (lieu && lieuComplet(lieu, vehicules, vehicule?.id)) {
      setErreur(`Le garage « ${lieu.nom} » est plein.`)
      return
    }
    const saisie = { modele, spawn, plaque, proprietaireUid: proprietaire, lieuId: lieuId || null, note }
    executer(() => (vehicule ? majVehicule(vehicule.id, saisie) : creerVehicule(saisie)))
  }

  function supprimer() {
    if (vehicule && window.confirm(`Supprimer le véhicule ${vehicule.modele} ?`)) {
      executer(() => supprimerVehicule(vehicule.id))
    }
  }

  return (
    <Modal title={vehicule ? 'Modifier le véhicule' : 'Ajouter un véhicule'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {proprietaires && (
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Propriétaire</span>
            <select className={inputClass} value={proprietaire} onChange={(e) => setProprietaire(e.target.value)}>
              {proprietaires.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {nomAffiche(m)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="space-y-1 text-sm">
          <span className="text-zinc-400">Modèle</span>
          <SelecteurModele
            catalogue={catalogue.items ?? []}
            modele={modele}
            spawn={spawn}
            onChange={(valeur) => {
              setModele(valeur.modele)
              setSpawn(valeur.spawn)
            }}
          />
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Plaque</span>
          <input
            className={`${inputClass} uppercase`}
            value={plaque}
            maxLength={12}
            onChange={(e) => setPlaque(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Garage</span>
          <select className={inputClass} value={lieuId} onChange={(e) => setLieuId(e.target.value)}>
            <option value="">Sans garage</option>
            {lieux.map((l) => (
              <option key={l.id} value={l.id} disabled={lieuComplet(l, vehicules, vehicule?.id)}>
                {l.nom} ({occupation(l, vehicules)} / {l.capacite})
                {lieuComplet(l, vehicules, vehicule?.id) ? ' — plein' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {vehicule && (
            <Button variant="danger" disabled={envoi} onClick={supprimer}>
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !modele.trim()}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
