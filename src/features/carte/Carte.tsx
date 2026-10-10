import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { CARTE } from '../../lib/carte'

// Ce que la carte affiche pour un point : sa place, sa couleur, et ce qu'il dit au survol
export interface Marqueur {
  id: string
  x: number
  y: number
  couleur: string
  // Texte au survol
  titre: string
  // Petit texte sous le marqueur (temps restant d'un plan…) ; vide : marqueur seul
  etiquette: string
  // Marqueur mis en avant (plan à arroser ou prêt, point en cours de déplacement)
  accent: boolean
}

const { largeur, hauteur, zoomMax, tuile } = CARTE

// Icône construite en éléments DOM, jamais en HTML : les textes viennent de la base
function icone(marqueur: Marqueur): L.DivIcon {
  const cadre = document.createElement('div')
  cadre.className = 'flex flex-col items-center'

  const pastille = document.createElement('span')
  pastille.className = `block size-5 rounded-full border-2 border-white shadow-[0_1px_4px_rgb(0_0_0/0.7)] ${
    marqueur.accent ? 'animate-pulse ring-4 ring-white/40' : ''
  }`
  pastille.style.backgroundColor = marqueur.couleur
  cadre.append(pastille)

  if (marqueur.etiquette) {
    const etiquette = document.createElement('span')
    etiquette.className =
      'mt-0.5 rounded bg-zinc-950/85 px-1 text-[0.7rem] leading-tight font-semibold whitespace-nowrap text-zinc-50'
    etiquette.textContent = marqueur.etiquette
    cadre.append(etiquette)
  }

  // Ancre au centre de la pastille, quelle que soit la largeur de l'étiquette
  return L.divIcon({ html: cadre, className: '', iconSize: [120, 20], iconAnchor: [60, 10] })
}

// Carte du serveur, en tuiles (public/carte, générées par `npm run carte`), avec les points posés dessus.
// `onClicCarte` reçoit la position cliquée, en fraction de la carte.
export function Carte({
  marqueurs,
  pose,
  onClicCarte,
  onClicMarqueur,
}: {
  marqueurs: Marqueur[]
  // true : on attend un clic pour poser ou déplacer un point (curseur en croix)
  pose: boolean
  onClicCarte: (position: { x: number; y: number }) => void
  onClicMarqueur: (id: string) => void
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<L.Map | null>(null)
  const calque = useRef<L.LayerGroup | null>(null)
  // Les gestionnaires Leaflet sont posés une fois : ils lisent toujours les dernières fonctions reçues
  const actions = useRef({ onClicCarte, onClicMarqueur })
  useEffect(() => {
    actions.current = { onClicCarte, onClicMarqueur }
  })

  useEffect(() => {
    if (!conteneur.current) return
    // Repère image : pas de géographie, les coordonnées sont des pixels de la carte
    const map = L.map(conteneur.current, {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: zoomMax + 1,
      zoomSnap: 0.5,
      attributionControl: false,
      maxBoundsViscosity: 1,
    })
    const bornes = L.latLngBounds(map.unproject([0, hauteur], zoomMax), map.unproject([largeur, 0], zoomMax))
    L.tileLayer('/carte/{z}/{x}/{y}.webp', {
      tileSize: tuile,
      minNativeZoom: 0,
      maxNativeZoom: zoomMax,
      minZoom: -1,
      maxZoom: zoomMax + 1,
      bounds: bornes,
      noWrap: true,
    }).addTo(map)
    map.fitBounds(bornes)
    map.setMaxBounds(bornes.pad(0.15))

    map.on('click', (e) => {
      const pixel = map.project(e.latlng, zoomMax)
      const position = { x: pixel.x / largeur, y: pixel.y / hauteur }
      if (position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1) actions.current.onClicCarte(position)
    })

    carte.current = map
    calque.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      carte.current = null
      calque.current = null
    }
  }, [])

  useEffect(() => {
    const map = carte.current
    const groupe = calque.current
    if (!map || !groupe) return
    groupe.clearLayers()
    for (const marqueur of marqueurs) {
      const position = map.unproject([marqueur.x * largeur, marqueur.y * hauteur], zoomMax)
      const infobulle = document.createElement('span')
      infobulle.textContent = marqueur.titre
      L.marker(position, { icon: icone(marqueur), zIndexOffset: marqueur.accent ? 1000 : 0 })
        .bindTooltip(infobulle, { direction: 'top', offset: [0, -10] })
        .on('click', (e) => {
          // Le clic sur un marqueur n'est pas un clic sur la carte
          L.DomEvent.stopPropagation(e)
          actions.current.onClicMarqueur(marqueur.id)
        })
        .addTo(groupe)
    }
  }, [marqueurs])

  return (
    // `isolate` : les couches de Leaflet restent sous les menus et fenêtres de l'appli.
    // Les classes qui changent sont sur le cadre extérieur : Leaflet pose les siennes sur le conteneur de la carte,
    // et React les effacerait en réécrivant son attribut `class`.
    <div
      className={`isolate h-[calc(100svh-15rem)] min-h-96 w-full overflow-hidden rounded-xl border border-zinc-800 ${
        // `!` : la feuille de style de Leaflet, hors couches Tailwind, l'emporterait sinon
        pose ? '[&_.leaflet-grab]:cursor-crosshair! [&_.leaflet-interactive]:cursor-crosshair!' : ''
      }`}
    >
      <div ref={conteneur} className="size-full bg-zinc-950!" />
    </div>
  )
}
