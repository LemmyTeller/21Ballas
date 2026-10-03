import { signOut } from 'firebase/auth'
import { Button, CenteredScreen, Logo } from '../components/ui'
import { ProfilForm } from '../features/members/ProfilForm'
import { auth } from '../lib/firebase'
import { messageRevocation } from '../lib/sorties'
import type { Membre } from '../types'

// `email` vient de la session du joueur lui-même, jamais de la fiche publique
export function Pending({ membre, email }: { membre: Membre; email: string | null }) {
  return (
    <CenteredScreen>
      <Logo />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-100">Compte en attente de validation</h1>
        <p className="text-sm text-zinc-400">
          Connecté avec {email}. Renseigne ton nom RP : ta demande n’est transmise aux gradés qu’une fois ce nom
          enregistré, et l’accès s’ouvrira automatiquement dès la validation.
        </p>
      </div>
      <ProfilForm membre={membre} />
      <Button variant="ghost" onClick={() => signOut(auth)}>
        Se déconnecter
      </Button>
    </CenteredScreen>
  )
}

export function Revoque({ membre, email }: { membre: Membre; email: string | null }) {
  return (
    <CenteredScreen>
      <Logo />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-zinc-100">Accès refusé</h1>
        <p className="text-sm text-zinc-300">{messageRevocation(membre.raisonRevocation)}</p>
        <p className="text-xs text-zinc-500">Connecté avec {email}</p>
      </div>
      <Button variant="ghost" onClick={() => signOut(auth)}>
        Se déconnecter
      </Button>
    </CenteredScreen>
  )
}
