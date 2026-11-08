import { useState } from 'react'
import { COULEUR_ENTREES, COULEUR_SORTIES } from '../lib/graphiques'
import { Card } from './ui'

// Géométrie du tracé, en unités du viewBox
const L = 640
const H = 200
const MARGE = { gauche: 40, droite: 8, haut: 10, bas: 24 }
const LARGEUR_MAX = 24
const ARRONDI = 3

// Pas d'axe rond (1, 2, 2,5, 5 × 10ⁿ) pour couvrir `maximum` en 2 ou 3 graduations
function pasRond(maximum: number): number {
  if (maximum <= 0) return 1
  const brut = maximum / 2
  const puissance = 10 ** Math.floor(Math.log10(brut))
  return Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut)
}

// Barre dont seul le bout est arrondi : elle part de la ligne de zéro, vers le haut (entrée) ou vers le bas (sortie)
function barre(x: number, zero: number, largeur: number, hauteur: number, versLeHaut: boolean): string {
  const r = Math.min(ARRONDI, hauteur, largeur / 2)
  if (versLeHaut) {
    const y = zero - hauteur
    return `M${x},${zero} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + largeur - r},${y} Q${x + largeur},${y} ${x + largeur},${y + r} L${x + largeur},${zero} Z`
  }
  const y = zero + hauteur
  return `M${x},${zero} L${x},${y - r} Q${x},${y} ${x + r},${y} L${x + largeur - r},${y} Q${x + largeur},${y} ${x + largeur},${y - r} L${x + largeur},${zero} Z`
}

// Entrées (au-dessus de zéro) et sorties (en dessous) d'un item, jour par jour. Survol ou tabulation : le détail
// du jour ; les chiffres restent lisibles sans survol dans le tableau repliable.
export function EntreesSorties({
  titre,
  etiquettes,
  entrees,
  sorties,
  format,
}: {
  titre: string
  etiquettes: string[]
  // Quantités positives, une par jour
  entrees: number[]
  sorties: number[]
  format: (valeur: number) => string
}) {
  const [survol, setSurvol] = useState<number | null>(null)
  const n = etiquettes.length
  const pas = pasRond(Math.max(...entrees, ...sorties))
  const haut = Math.max(pas, Math.ceil(Math.max(...entrees) / pas) * pas)
  const bas = Math.max(pas, Math.ceil(Math.max(...sorties) / pas) * pas)
  const vide = entrees.every((v) => v === 0) && sorties.every((v) => v === 0)

  const largeurTrace = L - MARGE.gauche - MARGE.droite
  const hauteurTrace = H - MARGE.haut - MARGE.bas
  const echelle = hauteurTrace / (haut + bas)
  const zero = MARGE.haut + haut * echelle
  const bande = largeurTrace / n
  const largeur = Math.min(LARGEUR_MAX, Math.max(2, bande - 4))
  const pasEtiquette = Math.ceil(n / 7)
  const graduations = [haut, 0, -bas]

  return (
    <Card className="p-4!">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-zinc-100">{titre}</h3>
        <ul className="flex gap-x-4 text-xs text-zinc-300">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs" style={{ backgroundColor: COULEUR_ENTREES }} />
            Entrées
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs" style={{ backgroundColor: COULEUR_SORTIES }} />
            Sorties
          </li>
        </ul>
      </div>

      <div className="relative" onPointerLeave={() => setSurvol(null)}>
        <svg viewBox={`0 0 ${L} ${H}`} className="block w-full" role="img" aria-label={titre}>
          {graduations.map((g) => (
            <g key={g}>
              <line
                x1={MARGE.gauche}
                x2={L - MARGE.droite}
                y1={zero - g * echelle}
                y2={zero - g * echelle}
                stroke={g === 0 ? '#52525b' : '#2c2c2e'}
                strokeWidth={1}
              />
              <text x={MARGE.gauche - 6} y={zero - g * echelle + 3.5} textAnchor="end" fontSize={11} fill="#898781">
                {g === 0 ? '0' : `${g > 0 ? '+' : '−'}${format(Math.abs(g))}`}
              </text>
            </g>
          ))}

          {etiquettes.map((etiquette, i) => {
            const x = MARGE.gauche + bande * i + (bande - largeur) / 2
            const attenue = survol !== null && survol !== i ? 0.55 : 1
            return (
              <g key={etiquette}>
                {survol === i && (
                  <rect x={MARGE.gauche + bande * i} y={MARGE.haut} width={bande} height={hauteurTrace} fill="#ffffff" opacity={0.05} />
                )}
                {entrees[i] > 0 && (
                  <path
                    d={barre(x, zero - 1, largeur, Math.max(1, entrees[i] * echelle - 1), true)}
                    fill={COULEUR_ENTREES}
                    opacity={attenue}
                  />
                )}
                {sorties[i] > 0 && (
                  <path
                    d={barre(x, zero + 1, largeur, Math.max(1, sorties[i] * echelle - 1), false)}
                    fill={COULEUR_SORTIES}
                    opacity={attenue}
                  />
                )}
                {i % pasEtiquette === 0 && (
                  <text x={MARGE.gauche + bande * (i + 0.5)} y={H - 7} textAnchor="middle" fontSize={11} fill="#898781">
                    {etiquette}
                  </text>
                )}
                {/* Zone de survol : toute la bande du jour, bien plus large que la barre */}
                <rect
                  x={MARGE.gauche + bande * i}
                  y={MARGE.haut}
                  width={bande}
                  height={hauteurTrace}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${etiquette} : entrées ${format(entrees[i])}, sorties ${format(sorties[i])}`}
                  className="outline-none"
                  onPointerEnter={() => setSurvol(i)}
                  onFocus={() => setSurvol(i)}
                  onBlur={() => setSurvol(null)}
                />
              </g>
            )
          })}
        </svg>

        {vide && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            Aucun mouvement sur la période
          </p>
        )}

        {survol !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-xl"
            style={{ left: `${Math.min(85, Math.max(15, ((MARGE.gauche + bande * (survol + 0.5)) / L) * 100))}%` }}
          >
            <p className="mb-1 text-zinc-400">{etiquettes[survol]}</p>
            <p className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COULEUR_ENTREES }} />
              <span className="font-semibold text-zinc-50 tabular-nums">+{format(entrees[survol])}</span>
              <span className="text-zinc-400">entrées</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COULEUR_SORTIES }} />
              <span className="font-semibold text-zinc-50 tabular-nums">−{format(sorties[survol])}</span>
              <span className="text-zinc-400">sorties</span>
            </p>
            <p className="mt-1 border-t border-zinc-800 pt-1 text-zinc-300 tabular-nums">
              Solde {entrees[survol] - sorties[survol] >= 0 ? '+' : '−'}
              {format(Math.abs(entrees[survol] - sorties[survol]))}
            </p>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-zinc-400">
        <summary className="cursor-pointer select-none hover:text-zinc-200">Voir les chiffres</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-1 font-medium">Jour</th>
                <th className="pb-1 text-right font-medium">Entrées</th>
                <th className="pb-1 text-right font-medium">Sorties</th>
                <th className="pb-1 text-right font-medium">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {etiquettes.map((etiquette, i) => (
                <tr key={etiquette}>
                  <td className="py-1">{etiquette}</td>
                  <td className="py-1 text-right text-zinc-200 tabular-nums">+{format(entrees[i])}</td>
                  <td className="py-1 text-right text-zinc-200 tabular-nums">−{format(sorties[i])}</td>
                  <td className="py-1 text-right text-zinc-200 tabular-nums">
                    {entrees[i] - sorties[i] >= 0 ? '+' : '−'}
                    {format(Math.abs(entrees[i] - sorties[i]))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}
