import { Timestamp } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Contrat } from '../../types'
import { creerContrat, majContrat, supprimerContrat } from './api'

const deuxChiffres = (n: number) => String(n).padStart(2, '0')
// Valeurs des champs date et heure, dans le fuseau du navigateur
const versDate = (d: Date) => `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
const versHeure = (d: Date) => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`
// « vendredis » à partir de la date saisie ; « 7 jours » tant qu'elle est vide
const jourSemaine = (date: string) =>
  date ? `${new Date(`${date}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long' })}s` : '7 jours'

// Création (sans `contrat`) ou modification d'une somme à payer
export function ContratModal({ contrat, onClose }: { contrat?: Contrat; onClose: () => void }) {
  const echeance = contrat?.echeance.toDate()
  const [libelle, setLibelle] = useState(contrat?.libelle ?? '')
  const [montant, setMontant] = useState(contrat ? String(contrat.montant) : '')
  const [date, setDate] = useState(echeance ? versDate(echeance) : '')
  const [heure, setHeure] = useState(echeance && contrat?.heureFixee ? versHeure(echeance) : '')
  const [hebdo, setHebdo] = useState(contrat?.hebdo ?? false)
  const [note, setNote] = useState(contrat?.note ?? '')
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
    const saisie = {
      libelle,
      montant: Number(montant),
      // Sans heure, l'échéance tombe à la fin de la journée
      echeance: Timestamp.fromDate(new Date(`${date}T${heure || '23:59'}`)),
      heureFixee: heure !== '',
      hebdo,
      note,
    }
    executer(() => (contrat ? majContrat(contrat, saisie) : creerContrat(saisie)))
  }

  return (
    <Modal title={contrat ? 'Modifier le contrat' : 'Ajouter un contrat'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Quoi / à qui</span>
          <input
            className={inputClass}
            value={libelle}
            maxLength={80}
            placeholder="Philippe, Benny’s…"
            required
            autoFocus
            onChange={(e) => setLibelle(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Montant à payer ($)</span>
          <input
            type="number"
            className={inputClass}
            value={montant}
            min={0}
            step="any"
            required
            onChange={(e) => setMontant(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">{hebdo ? 'Prochaine échéance' : 'À payer avant le'}</span>
            <input type="date" className={inputClass} value={date} required onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Heure (facultatif)</span>
            <input type="time" className={inputClass} value={heure} onChange={(e) => setHeure(e.target.value)} />
          </label>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-purple-500"
            checked={hebdo}
            onChange={(e) => setHebdo(e.target.checked)}
          />
          <span>
            <span className="text-zinc-100">Chaque semaine</span>
            <span className="block text-xs text-zinc-500">
              À payer tous les {jourSemaine(date)}, à la même heure. Une fois une échéance payée et passée, la suivante
              devient due.
            </span>
          </span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {contrat && (
            <Button
              variant="danger"
              disabled={envoi}
              onClick={() => {
                if (window.confirm(`Supprimer le contrat « ${contrat.libelle} » ?`)) {
                  executer(() => supprimerContrat(contrat.id))
                }
              }}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !libelle.trim() || montant === '' || !date}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
