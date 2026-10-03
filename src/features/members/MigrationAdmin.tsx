import { useState, type FormEvent } from 'react'
import { Button, CenteredScreen, ErrorMessage, Logo, inputClass } from '../../components/ui'
import { ROLE_LABELS, ROLES_VALIDES } from '../../lib/roles'
import type { Membre, Role } from '../../types'
import { migrerAdmin } from './api'

// Affiché une seule fois à un compte encore au grade « Admin » : ce grade n'existe plus. Le compte garde tous ses
// droits (droit admin, invisible des autres) et choisit le grade RP sous lequel il apparaîtra.
export function MigrationAdmin({ membre }: { membre: Membre }) {
  const [role, setRole] = useState<Exclude<Role, 'revoque'>>('membre')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function valider(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await migrerAdmin(membre.uid, role)
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <CenteredScreen>
      <Logo />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-100">Choisis ton grade</h1>
        <p className="text-sm text-zinc-400">
          « Admin » n’est plus un grade. Tu gardes tous tes droits d’administration, mais ils deviennent invisibles :
          les autres membres te verront avec le grade que tu choisis ici. Tu pourras le changer depuis la page Membres.
        </p>
      </div>
      <form onSubmit={valider} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Grade affiché</span>
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<Role, 'revoque'>)}
          >
            {ROLES_VALIDES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <Button type="submit" className="w-full py-2.5" disabled={envoi}>
          Valider
        </Button>
      </form>
    </CenteredScreen>
  )
}
