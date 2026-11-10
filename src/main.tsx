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
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('apercu') === 'carte') {
  // Aperçu de la carte seule, sans connexion, en développement uniquement : http://localhost:5173/?apercu=carte
  const { Carte } = await import('./features/carte/Carte.tsx')
  const point = { accent: false, etiquette: '' }
  // Le bouton bascule le mode « pose » : la carte doit survivre au changement de ses propriétés
  const afficher = (pose: boolean) =>
    root.render(
      <div className="space-y-2 p-4">
        <button
          type="button"
          className="rounded-md border border-zinc-700 px-3 py-1 text-sm"
          onClick={() => afficher(!pose)}
        >
          Mode pose : {pose ? 'oui' : 'non'}
        </button>
        <Carte
          pose={pose}
          onClicCarte={(position) => console.log('clic carte', position)}
          onClicMarqueur={(id) => console.log('clic marqueur', id)}
          marqueurs={[
            { ...point, id: 'a', x: 0.5, y: 0.82, couleur: '#9333ea', titre: 'Commerce' },
            { ...point, id: 'b', x: 0.45, y: 0.6, couleur: '#16a34a', titre: '12 plants', etiquette: '24 min' },
            {
              ...point,
              id: 'c',
              x: 0.6,
              y: 0.4,
              couleur: '#eab308',
              titre: '8 plants',
              etiquette: 'Prêt',
              accent: true,
            },
          ]}
        />
      </div>,
    )
  afficher(false)
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('apercu') === 'graphiques') {
  // Aperçu des graphiques avec des données d'exemple, en développement : http://localhost:5173/?apercu=graphiques
  const { EntreesSorties } = await import('./components/EntreesSorties.tsx')
  const jours = Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, '0')}/10`)
  const format = (v: number) => String(v)
  root.render(
    <div className="grid gap-4 p-4 xl:grid-cols-3">
      <EntreesSorties
        titre="Graines de weed"
        etiquettes={jours}
        format={format}
        entrees={[20, 0, 10, 30, 0, 0, 40, 10, 0, 20, 30, 0, 10, 20]}
        sorties={[12, 8, 0, 25, 6, 0, 30, 4, 0, 18, 22, 6, 0, 15]}
      />
      <EntreesSorties
        titre="Pochons de weed"
        etiquettes={jours}
        format={format}
        entrees={[120, 250, 0, 80, 500, 340, 60, 0, 150, 730, 410, 90, 220, 380]}
        sorties={[100, 0, 0, 300, 450, 0, 60, 20, 0, 600, 200, 0, 220, 100]}
      />
      <EntreesSorties
        titre="Sans donnée"
        etiquettes={jours}
        format={format}
        entrees={jours.map(() => 0)}
        sorties={jours.map(() => 0)}
      />
    </div>,
  )
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('apercu') === 'roue') {
  // Aperçu de la roue seule, sans connexion, en développement : http://localhost:5173/?apercu=roue
  const { Roue } = await import('./features/roue/Roue.tsx')
  const { tirerCase } = await import('./lib/roue.ts')
  let rotation = 0
  const afficher = (enRotation: boolean) =>
    root.render(
      <div className="mx-auto max-w-md space-y-4 p-4">
        <button
          type="button"
          className="rounded-md border border-zinc-700 px-3 py-1 text-sm"
          onClick={() => {
            rotation += 5 * 360 + ((360 - tirerCase() * 22.5 - (rotation % 360) + 720) % 360)
            afficher(true)
          }}
        >
          Tourner
        </button>
        <Roue rotation={rotation} enRotation={enRotation} />
      </div>,
    )
  afficher(false)
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
