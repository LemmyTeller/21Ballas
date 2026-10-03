import { CenteredScreen, Logo } from './components/ui'

export function ConfigManquante() {
  return (
    <CenteredScreen>
      <Logo />
      <h1 className="text-lg font-semibold text-zinc-100">Configuration Firebase manquante</h1>
      <p className="text-sm text-zinc-400">
        Copie <code className="text-purple-300">.env.example</code> en{' '}
        <code className="text-purple-300">.env.local</code>, renseigne la config web du projet Firebase, puis relance{' '}
        <code className="text-purple-300">npm run dev</code>.
      </p>
    </CenteredScreen>
  )
}
