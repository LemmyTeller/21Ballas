import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ConfigManquante } from './ConfigManquante.tsx'
import { isConfigured } from './lib/config.ts'
import { appliquerTaille, lireTaille } from './lib/preferences.ts'

// Avant le premier rendu : l'appli s'ouvre directement à la taille choisie par le joueur
appliquerTaille(lireTaille())

const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV && new URLSearchParams(location.search).get('apercu') === 'chargement') {
  // Aperçu de l'écran de chargement, en développement uniquement : http://localhost:5173/?apercu=chargement
  const { Chargement } = await import('./components/ui.tsx')
  root.render(<Chargement pleinEcran />)
} else if (isConfigured) {
  // Import différé : Firebase ne doit pas s'initialiser sans configuration
  const { default: App } = await import('./App.tsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ConfigManquante />
    </StrictMode>,
  )
}
