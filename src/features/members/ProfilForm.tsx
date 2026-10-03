import { useState, type FormEvent } from 'react'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import type { Membre } from '../../types'
import { majProfil } from './api'

export function ProfilForm({ membre }: { membre: Membre }) {
  const [nomRP, setNomRP] = useState(membre.nomRP)
  const [telephoneRP, setTelephoneRP] = useState(membre.telephoneRP)
  const [anniversaireRP, setAnniversaireRP] = useState(membre.anniversaireRP ?? '')
  const [etat, setEtat] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setEtat('saving')
    setErreur(null)
    try {
      await majProfil(membre.uid, { nomRP, telephoneRP, anniversaireRP })
      setEtat('saved')
    } catch (err) {
      setErreur((err as Error).message)
      setEtat('idle')
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Nom RP (prénom et nom du personnage)</span>
        <input
          className={inputClass}
          value={nomRP}
          maxLength={60}
          required
          onChange={(e) => {
            setNomRP(e.target.value)
            setEtat('idle')
          }}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Téléphone en jeu (facultatif)</span>
        <input
          className={inputClass}
          value={telephoneRP}
          maxLength={20}
          onChange={(e) => {
            setTelephoneRP(e.target.value)
            setEtat('idle')
          }}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-zinc-400">Anniversaire du personnage (JJ/MM, facultatif)</span>
        <input
          className={inputClass}
          value={anniversaireRP}
          placeholder="21/10"
          maxLength={5}
          pattern="(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])"
          title="Format JJ/MM, par exemple 21/10"
          onChange={(e) => {
            setAnniversaireRP(e.target.value)
            setEtat('idle')
          }}
        />
      </label>
      <ErrorMessage>{erreur}</ErrorMessage>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={etat === 'saving'}>
          Enregistrer
        </Button>
        {etat === 'saved' && <span className="text-sm text-emerald-400">Enregistré</span>}
      </div>
    </form>
  )
}
