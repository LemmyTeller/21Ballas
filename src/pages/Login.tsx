import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { useState } from 'react'
import { Button, CenteredScreen, ErrorMessage, Logo } from '../components/ui'
import { auth } from '../lib/firebase'

const ANNULATIONS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export function Login() {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function connexion() {
    setErreur(null)
    setEnCours(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (!ANNULATIONS.includes(code)) setErreur(`Connexion impossible (${code || (e as Error).message})`)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <CenteredScreen>
      <Logo />
      <p className="text-sm text-zinc-400">
        Accès réservé aux membres du groupe. Après ta première connexion, un chef doit valider ton compte.
      </p>
      <ErrorMessage>{erreur}</ErrorMessage>
      <Button className="w-full py-2.5" onClick={connexion} disabled={enCours}>
        Se connecter avec Google
      </Button>
    </CenteredScreen>
  )
}
