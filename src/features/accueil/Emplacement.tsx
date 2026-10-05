import type { ReactNode } from 'react'
import { LARGEURS, type Largeur } from '../../lib/preferences'

// Emplacement d'un encart sur l'accueil. Hors modification, il ne fait qu'afficher l'encart. En modification,
// l'encart est figé (aucun clic ne l'atteint) et se glisse sur un autre emplacement pour échanger leurs places ;
// sans souris, on touche un encart puis celui avec lequel l'échanger. Sa largeur se règle par la liste en haut à droite.
// La structure rendue est la même dans les deux modes : l'encart n'est pas remonté quand on entre en modification.
export function Emplacement({
  nom,
  edition,
  choisi,
  survole,
  largeur,
  onLargeur,
  onChoisir,
  onGlisser,
  onSurvoler,
  onDeposer,
  children,
}: {
  largeur: Largeur
  onLargeur: (largeur: Largeur) => void
  nom: string
  edition: boolean
  // Encart en cours de déplacement
  choisi: boolean
  // Emplacement au-dessus duquel passe l'encart glissé
  survole: boolean
  onChoisir: () => void
  onGlisser: () => void
  onSurvoler: (dessus: boolean) => void
  onDeposer: () => void
  children: ReactNode
}) {
  const modification = edition
    ? {
        role: 'button',
        tabIndex: 0,
        draggable: true,
        'aria-pressed': choisi,
        'aria-label': `Déplacer l’encart ${nom}`,
        onClick: onChoisir,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onChoisir()
          }
        },
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.effectAllowed = 'move'
          // Firefox ne démarre un glisser que si des données l'accompagnent
          e.dataTransfer.setData('text/plain', nom)
          onGlisser()
        },
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onSurvoler(true)
        },
        onDragLeave: () => onSurvoler(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          onDeposer()
        },
      }
    : {}

  return (
    <div
      {...modification}
      className={`relative min-w-0 ${
        edition
          ? `cursor-grab rounded-xl outline-2 outline-offset-4 outline-dashed active:cursor-grabbing ${
              survole ? 'outline-emerald-400' : choisi ? 'outline-purple-300' : 'outline-purple-600/60'
            }`
          : ''
      }`}
    >
      <div inert={edition} className={edition ? `pointer-events-none select-none ${choisi ? 'opacity-50' : ''}` : ''}>
        {children}
      </div>
      {edition && (
        <span className="absolute -top-3 left-3 z-10 rounded-full bg-purple-700 px-2.5 py-0.5 text-xs font-medium text-white">
          {choisi ? `${nom} — choisis sa nouvelle place` : nom}
        </span>
      )}
      {edition && (
        <select
          aria-label={`Largeur de l’encart ${nom}`}
          title="Largeur de l’encart"
          className="absolute -top-3 right-3 z-10 cursor-pointer rounded-full border border-purple-600 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-100 focus:outline-none"
          value={largeur}
          // Régler la largeur ne doit pas compter comme le choix de l'encart à déplacer
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onLargeur(e.target.value as Largeur)}
        >
          {Object.entries(LARGEURS).map(([cle, l]) => (
            <option key={cle} value={cle}>
              {l.nom}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
