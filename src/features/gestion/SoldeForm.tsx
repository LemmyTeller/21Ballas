import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import { nomAffiche } from '../../lib/roles'
import type { Membre } from '../../types'
import { majSolde } from './api'

// Solde du compte bancaire d'un membre : le sien (Paramètres) ou celui d'un rang inférieur (Gestion)
export function SoldeForm({ membre, onSaved }: { membre: Membre; onSaved?: () => void }) {
  const [montant, setMontant] = useState(String(membre.compteBancaire ?? 0))
  const [etat, setEtat] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setEtat('saving')
    setErreur(null)
    try {
      await majSolde(membre.uid, Number(montant))
      setEtat('saved')
      onSaved?.()
    } catch (err) {
      setErreur((err as Error).message)
      setEtat('idle')
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Solde du compte bancaire ($)</span>
        <input
          type="number"
          className={inputClass}
          value={montant}
          min={0}
          step={1}
          required
          onChange={(e) => {
            setMontant(e.target.value)
            setEtat('idle')
          }}
        />
      </label>
      <ErrorMessage>{erreur}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={etat === 'saving' || montant === ''}>
          Enregistrer
        </Button>
        {etat === 'saved' && <span className="text-sm text-emerald-400">Enregistré</span>}
      </div>
    </form>
  )
}

export function SoldeModal({ membre, onClose }: { membre: Membre; onClose: () => void }) {
  return (
    <Modal title={`Solde de ${nomAffiche(membre)}`} onClose={onClose}>
      <SoldeForm membre={membre} onSaved={onClose} />
    </Modal>
  )
}
