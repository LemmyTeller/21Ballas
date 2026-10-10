import { useState } from 'react'
import { Card } from './ui'

export interface Serie {
  nom: string
  couleur: string
  valeurs: number[]
}

// Géométrie du tracé, en unités du viewBox
const L = 640
const H = 220
const MARGE = { gauche: 46, droite: 8, haut: 12, bas: 26 }
const LARGEUR_MAX = 24
const ESPACE = 2
const ARRONDI = 4

// Graduations rondes : 0, puis 3 ou 4 pas propres jusqu'au-dessus du maximum
function graduations(maximum: number): number[] {
  if (maximum <= 0) return [0, 1]
  const brut = maximum / 4
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut
  const pasEntier = Math.max(1, pas)
  const liste = []
  for (let v = 0; v < maximum + pasEntier; v += pasEntier) liste.push(v)
  return liste
}

// Colonne dont seul le sommet est arrondi : elle part d'une base droite
function colonne(x: number, y: number, largeur: number, hauteur: number, arrondie: boolean): string {
  const r = arrondie ? Math.min(ARRONDI, hauteur, largeur / 2) : 0
  return `M${x},${y + hauteur} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + largeur - r},${y} Q${x + largeur},${y} ${x + largeur},${y + r} L${x + largeur},${y + hauteur} Z`
}

// Histogramme par jour, une ou plusieurs séries empilées. Survol ou tabulation sur une colonne : le détail du jour.
// Les chiffres restent lisibles sans survol, dans le tableau repliable sous le graphique.
export function Colonnes({
  titre,
  etiquettes,
  series,
  format,
}: {
  titre: string
  // Une étiquette par colonne (le jour)
  etiquettes: string[]
  series: Serie[]
  format: (valeur: number) => string
}) {
  const [survol, setSurvol] = useState<number | null>(null)
  const n = etiquettes.length
  const totaux = etiquettes.map((_, i) => series.reduce((total, s) => total + s.valeurs[i], 0))
  const ticks = graduations(Math.max(...totaux))
  const sommet = ticks[ticks.length - 1]
  const vide = totaux.every((t) => t === 0)

  const largeurTrace = L - MARGE.gauche - MARGE.droite
  const hauteurTrace = H - MARGE.haut - MARGE.bas
  const bande = largeurTrace / n
  const largeur = Math.min(LARGEUR_MAX, Math.max(2, bande - 4))
  const y = (valeur: number) => MARGE.haut + hauteurTrace * (1 - valeur / sommet)
  // Assez d'étiquettes de jours pour se repérer, pas au point de se chevaucher
  const pasEtiquette = Math.ceil(n / 8)

  return (
    <Card className="p-4!">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-zinc-100">{titre}</h3>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 text-xs text-zinc-300">
            {series.map((s) => (
              <li key={s.nom} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs" style={{ backgroundColor: s.couleur }} />
                {s.nom}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative" onPointerLeave={() => setSurvol(null)}>
        <svg viewBox={`0 0 ${L} ${H}`} className="block w-full" role="img" aria-label={titre}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGE.gauche}
                x2={L - MARGE.droite}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? '#52525b' : '#2c2c2e'}
                strokeWidth={1}
              />
              <text x={MARGE.gauche - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="#898781">
                {format(t)}
              </text>
            </g>
          ))}

          {etiquettes.map((etiquette, i) => {
            const x = MARGE.gauche + bande * i + (bande - largeur) / 2
            // Les segments s'empilent depuis la base, séparés par un mince espace de fond
            let base = 0
            const segments = series
              .map((s) => ({ couleur: s.couleur, valeur: s.valeurs[i] }))
              .filter((s) => s.valeur > 0)
            return (
              <g key={etiquette}>
                {survol === i && (
                  <rect x={MARGE.gauche + bande * i} y={MARGE.haut} width={bande} height={hauteurTrace} fill="#ffffff" opacity={0.05} />
                )}
                {segments.map((s, rang) => {
                  const bas = y(base)
                  base += s.valeur
                  const haut = y(base)
                  const dernier = rang === segments.length - 1
                  const hauteur = Math.max(1, bas - haut - (dernier ? 0 : ESPACE))
                  return (
                    <path
                      key={rang}
                      d={colonne(x, bas - hauteur, largeur, hauteur, dernier)}
                      fill={s.couleur}
                      opacity={survol === null || survol === i ? 1 : 0.55}
                    />
                  )
                })}
                {i % pasEtiquette === 0 && (
                  <text x={MARGE.gauche + bande * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={11} fill="#898781">
                    {etiquette}
                  </text>
                )}
                {/* Zone de survol : toute la bande du jour, bien plus large que la colonne */}
                <rect
                  x={MARGE.gauche + bande * i}
                  y={MARGE.haut}
                  width={bande}
                  height={hauteurTrace}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${etiquette} : ${series.map((s) => `${s.nom} ${format(s.valeurs[i])}`).join(', ')}`}
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
            Rien sur la période
          </p>
        )}

        {survol !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-xl"
            style={{
              left: `${Math.min(88, Math.max(12, ((MARGE.gauche + bande * (survol + 0.5)) / L) * 100))}%`,
            }}
          >
            <p className="mb-1 text-zinc-400">{etiquettes[survol]}</p>
            {series.map((s) => (
              <p key={s.nom} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.couleur }} />
                <span className="font-semibold text-zinc-50 tabular-nums">{format(s.valeurs[survol])}</span>
                <span className="text-zinc-400">{s.nom}</span>
              </p>
            ))}
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
                {series.map((s) => (
                  <th key={s.nom} className="pb-1 text-right font-medium">
                    {s.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {etiquettes.map((etiquette, i) => (
                <tr key={etiquette}>
                  <td className="py-1">{etiquette}</td>
                  {series.map((s) => (
                    <td key={s.nom} className="py-1 text-right text-zinc-200 tabular-nums">
                      {format(s.valeurs[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}
