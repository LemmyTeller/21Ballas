import logo from '../../assets/B-ballas.webp'
import { CASES_ROUE, estGain } from '../../lib/roue'

const TAILLE = 400
const CENTRE = TAILLE / 2
// Rayon des cases, et de la couronne qui les entoure
const RAYON = 170
const COURONNE = 188
const ANGLE = 360 / CASES_ROUE.length

// Point du cercle à `angle` degrés, mesuré depuis le haut dans le sens des aiguilles d'une montre
function point(angle: number, rayon: number): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180
  return [CENTRE + rayon * Math.cos(radians), CENTRE + rayon * Math.sin(radians)]
}

// Habillage d'une case : le jackpot (X2) en or, les autres gains en mauve, plus vif pour les multiplicateurs,
// les pertes en anthracite avec un texte rouge
function habillage(index: number): { fond: string; texte: string; contour: string } {
  const caseRoue = CASES_ROUE[index]
  if (caseRoue.effet.type === 'fois' && caseRoue.effet.valeur >= 2) {
    return { fond: 'url(#roue-or)', texte: '#1c1917', contour: '#fef3c7' }
  }
  if (!estGain(caseRoue)) return { fond: 'url(#roue-perte)', texte: '#fca5a5', contour: '#0c0a09' }
  if (caseRoue.effet.type === 'fois') return { fond: 'url(#roue-vif)', texte: '#ffffff', contour: '#0c0a09' }
  return { fond: index % 2 === 0 ? 'url(#roue-mauve)' : 'url(#roue-sombre)', texte: '#f5f3ff', contour: '#0c0a09' }
}

// Orientation d'un libellé : dans l'axe de sa case, retourné sur la moitié gauche pour ne jamais être à l'envers
function orientation(angle: number): number {
  return angle > 180 ? angle + 90 : angle - 90
}

// La roue, tournée de `rotation` degrés. Une transition CSS sur la rotation la fait tourner puis ralentir.
// Aucun filtre graphique : seule la rotation est animée, ce qui reste léger pour le processeur.
export function Roue({ rotation, enRotation }: { rotation: number; enRotation: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[36rem]">
      {/* Halo fixe derrière la roue */}
      <div className="absolute inset-[6%] rounded-full shadow-[0_0_60px_rgb(168_85_247/0.35)]" aria-hidden="true" />

      {/* Repère fixe en haut : la case qui s'arrête dessous est la case tirée */}
      <svg viewBox="0 0 48 56" className="absolute top-0 left-1/2 z-10 w-14 -translate-x-1/2" aria-hidden="true">
        <defs>
          <linearGradient id="roue-repere" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <path d="M24 54 L6 16 A18 18 0 1 1 42 16 Z" fill="url(#roue-repere)" stroke="#18181b" strokeWidth="3" />
        <circle cx="24" cy="17" r="6" fill="#18181b" />
      </svg>

      <svg
        viewBox={`0 0 ${TAILLE} ${TAILLE}`}
        className="relative h-full w-full"
        role="img"
        aria-label="Roue de la chance"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: enRotation ? 'transform 5.5s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none',
        }}
      >
        <defs>
          <radialGradient id="roue-mauve">
            <stop offset="0.3" stopColor="#4c1d95" />
            <stop offset="1" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="roue-sombre">
            <stop offset="0.3" stopColor="#2e1065" />
            <stop offset="1" stopColor="#5b21b6" />
          </radialGradient>
          <radialGradient id="roue-vif">
            <stop offset="0.3" stopColor="#7e22ce" />
            <stop offset="1" stopColor="#c026d3" />
          </radialGradient>
          <radialGradient id="roue-perte">
            <stop offset="0.3" stopColor="#18181b" />
            <stop offset="1" stopColor="#3f3f46" />
          </radialGradient>
          <radialGradient id="roue-or">
            <stop offset="0.3" stopColor="#b45309" />
            <stop offset="1" stopColor="#facc15" />
          </radialGradient>
          <linearGradient id="roue-couronne" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c084fc" />
            <stop offset="0.5" stopColor="#581c87" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {/* Couronne et ampoules, une à chaque séparation de cases, en alternant or et blanc */}
        <circle cx={CENTRE} cy={CENTRE} r={COURONNE} fill="url(#roue-couronne)" />
        <circle cx={CENTRE} cy={CENTRE} r={COURONNE - 4} fill="#0c0a09" />
        {CASES_ROUE.map((_, i) => {
          const [x, y] = point(i * ANGLE - ANGLE / 2, (COURONNE + RAYON) / 2 + 1)
          return <circle key={i} cx={x} cy={y} r={4} fill={i % 2 === 0 ? '#fde68a' : '#fafafa'} />
        })}

        {CASES_ROUE.map((caseRoue, i) => {
          const debut = i * ANGLE - ANGLE / 2
          const [x1, y1] = point(debut, RAYON)
          const [x2, y2] = point(debut + ANGLE, RAYON)
          const [xt, yt] = point(i * ANGLE, RAYON * 0.66)
          const { fond, texte, contour } = habillage(i)
          return (
            <g key={i}>
              <path
                d={`M${CENTRE},${CENTRE} L${x1},${y1} A${RAYON},${RAYON} 0 0 1 ${x2},${y2} Z`}
                fill={fond}
                stroke="#0c0a09"
                strokeWidth={2.5}
              />
              {/* Libellé dans l'axe de la case */}
              <text
                x={xt}
                y={yt}
                fill={texte}
                fontSize={caseRoue.libelle.length > 4 ? 17 : 21}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${orientation(i * ANGLE)} ${xt} ${yt})`}
                style={{ paintOrder: 'stroke' }}
                stroke={contour}
                strokeWidth={3}
                strokeLinejoin="round"
              >
                {caseRoue.libelle}
              </text>
            </g>
          )
        })}

        {/* Moyeu au logo du groupe */}
        <circle cx={CENTRE} cy={CENTRE} r={40} fill="url(#roue-couronne)" />
        <circle cx={CENTRE} cy={CENTRE} r={35} fill="#0c0a09" />
        <image href={logo} x={CENTRE - 26} y={CENTRE - 26} width={52} height={52} />
      </svg>
    </div>
  )
}
