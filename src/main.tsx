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
  const { Colonnes } = await import('./components/Colonnes.tsx')
  const { COULEURS_SERIES } = await import('./lib/graphiques.ts')
  const jours = Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, '0')}/10`)
  root.render(
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      <Colonnes
        titre="Caisses par jour"
        etiquettes={jours}
        format={(v) => String(v)}
        series={[
          { nom: 'Récupérées', couleur: COULEURS_SERIES[0], valeurs: [3, 5, 0, 2, 6, 4, 1, 0, 3, 7, 5, 2, 4, 6] },
          { nom: 'Perdues', couleur: COULEURS_SERIES[1], valeurs: [1, 0, 0, 2, 1, 0, 3, 0, 1, 0, 2, 1, 0, 1] },
        ]}
      />
      <Colonnes
        titre="Pochons produits par jour"
        etiquettes={jours}
        format={(v) => String(v)}
        series={[
          {
            nom: 'Pochons produits',
            couleur: COULEURS_SERIES[0],
            valeurs: [120, 250, 0, 80, 500, 340, 60, 0, 150, 730, 410, 90, 220, 380],
          },
        ]}
      />
      <Colonnes
        titre="Sans donnée"
        etiquettes={jours}
        format={(v) => String(v)}
        series={[{ nom: 'Têtes', couleur: COULEURS_SERIES[0], valeurs: jours.map(() => 0) }]}
      />
    </div>,
  )
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
