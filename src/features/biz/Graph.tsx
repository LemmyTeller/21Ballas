import { useState } from 'react'
import { Colonnes } from '../../components/Colonnes'
import { Card, ErrorMessage } from '../../components/ui'
import { GRAINES_PAR_CAISSE, REFERENCE_POCHON } from '../../lib/biz'
import { formatNombre, formatPrix } from '../../lib/format'
import { COULEURS_SERIES } from '../../lib/graphiques'
import { jourDeSaisie } from '../../lib/journee'
import type { Caisse, Recolte, Transformation } from '../../types'
import { useCommandes } from '../commerce/useCommandes'

const PERIODES = [7, 14, 30]
const JOUR_MS = 24 * 3_600_000

type Horodate = { toMillis: () => number } | null | undefined

// Suivi chiffré du business, réservé aux admins : indicateurs de la période, comparés à la précédente, et
// évolution jour par jour. Les journées sont celles du jeu (bascule à 3 h), comme la saisie journalière.
export function Graph({
  caisses,
  lots,
  recoltes,
  maintenant,
}: {
  caisses: Caisse[]
  lots: Transformation[]
  recoltes: Recolte[]
  maintenant: number
}) {
  const commandes = useCommandes()
  const [periode, setPeriode] = useState(14)

  // Les `periode` dernières journées, de la plus ancienne à aujourd'hui, et les `periode` d'avant pour comparer
  const journees = (decalage: number) =>
    Array.from({ length: periode }, (_, i) => jourDeSaisie(maintenant - (decalage + periode - 1 - i) * JOUR_MS))
  const jours = journees(0)
  const joursAvant = journees(periode)
  const etiquettes = jours.map((j) => `${j.slice(8, 10)}/${j.slice(5, 7)}`)

  // Total par journée d'une mesure, à partir d'éléments horodatés
  function parJour<T>(elements: T[], date: (e: T) => Horodate, valeur: (e: T) => number): Map<string, number> {
    const totaux = new Map<string, number>()
    for (const element of elements) {
      const instant = date(element)
      if (!instant) continue
      const jour = jourDeSaisie(instant.toMillis())
      totaux.set(jour, (totaux.get(jour) ?? 0) + valeur(element))
    }
    return totaux
  }
  const serie = (totaux: Map<string, number>, liste = jours) => liste.map((j) => totaux.get(j) ?? 0)
  const somme = (valeurs: number[]) => valeurs.reduce((total, v) => total + v, 0)

  const closes = caisses.filter((c) => c.statut === 'close')
  const ventes = commandes.data.filter((c) => c.statut === 'validee')
  const pochonsVendusDe = (lignes: { reference: string; sens: string; quantite: number }[]) =>
    lignes.filter((l) => l.sens === 'vente' && l.reference === REFERENCE_POCHON).reduce((total, l) => total + l.quantite, 0)

  const mesures = {
    recuperees: parJour(closes, (c) => c.closAt, (c) => c.recuperees ?? 0),
    perdues: parJour(closes, (c) => c.closAt, (c) => c.quantite - (c.recuperees ?? 0)),
    tetes: parJour(recoltes, (r) => r.createdAt, (r) => r.tetes),
    produits: parJour(
      lots.filter((l) => l.statut === 'recupere'),
      (l) => l.recupereAt,
      (l) => l.pochons ?? 0,
    ),
    vendus: parJour(ventes, (c) => c.clotureAt, (c) => pochonsVendusDe(c.lignes)),
    propre: parJour(ventes, (c) => c.clotureAt, (c) => c.recuPropre ?? 0),
    sale: parJour(ventes, (c) => c.clotureAt, (c) => c.recuSale ?? 0),
  }
  const total = (cle: keyof typeof mesures, liste = jours) => somme(serie(mesures[cle], liste))
  const reussite = (liste: string[]) => {
    const recuperees = total('recuperees', liste)
    const commandees = recuperees + total('perdues', liste)
    return commandees > 0 ? Math.round((recuperees / commandees) * 100) : null
  }

  return (
    <>
      {/* Une seule période pour tout ce qui suit : indicateurs et graphiques parlent des mêmes jours */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-zinc-800 p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periode === p}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periode === p ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
              onClick={() => setPeriode(p)}
            >
              {p} jours
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">Journées de jeu (de 3 h à 3 h). Visible par les admins uniquement.</p>
      </div>

      <ErrorMessage>{commandes.error}</ErrorMessage>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur
          label="Réussite des caisses"
          valeur={reussite(jours)}
          avant={reussite(joursAvant)}
          format={(v) => `${v} %`}
          unite="pt"
          periode={periode}
        />
        <Indicateur
          label="Graines reçues"
          valeur={total('recuperees') * GRAINES_PAR_CAISSE}
          avant={total('recuperees', joursAvant) * GRAINES_PAR_CAISSE}
          format={formatNombre}
          periode={periode}
        />
        <Indicateur
          label="Têtes récoltées"
          valeur={total('tetes')}
          avant={total('tetes', joursAvant)}
          format={formatNombre}
          periode={periode}
        />
        <Indicateur
          label="Pochons produits"
          valeur={total('produits')}
          avant={total('produits', joursAvant)}
          format={formatNombre}
          periode={periode}
        />
        <Indicateur
          label="Pochons vendus"
          valeur={total('vendus')}
          avant={total('vendus', joursAvant)}
          format={formatNombre}
          periode={periode}
        />
        <Indicateur
          label="Caisses perdues"
          valeur={total('perdues')}
          avant={total('perdues', joursAvant)}
          format={formatNombre}
          hausseMauvaise
          periode={periode}
        />
        <Indicateur
          label="Ventes, argent propre"
          valeur={total('propre')}
          avant={total('propre', joursAvant)}
          format={formatPrix}
          periode={periode}
        />
        <Indicateur
          label="Ventes, argent sale"
          valeur={total('sale')}
          avant={total('sale', joursAvant)}
          format={formatPrix}
          periode={periode}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Colonnes
          titre="Caisses par jour"
          etiquettes={etiquettes}
          format={formatNombre}
          series={[
            { nom: 'Récupérées', couleur: COULEURS_SERIES[0], valeurs: serie(mesures.recuperees) },
            { nom: 'Perdues', couleur: COULEURS_SERIES[1], valeurs: serie(mesures.perdues) },
          ]}
        />
        <Colonnes
          titre="Têtes récoltées par jour"
          etiquettes={etiquettes}
          format={formatNombre}
          series={[{ nom: 'Têtes', couleur: COULEURS_SERIES[0], valeurs: serie(mesures.tetes) }]}
        />
        <Colonnes
          titre="Pochons produits par jour"
          etiquettes={etiquettes}
          format={formatNombre}
          series={[{ nom: 'Pochons produits', couleur: COULEURS_SERIES[0], valeurs: serie(mesures.produits) }]}
        />
        <Colonnes
          titre="Pochons vendus par jour"
          etiquettes={etiquettes}
          format={formatNombre}
          series={[{ nom: 'Pochons vendus', couleur: COULEURS_SERIES[0], valeurs: serie(mesures.vendus) }]}
        />
        <Colonnes
          titre="Encaissé sur les ventes, par jour"
          etiquettes={etiquettes}
          format={formatPrix}
          series={[
            { nom: 'Propre', couleur: COULEURS_SERIES[0], valeurs: serie(mesures.propre) },
            { nom: 'Sale', couleur: COULEURS_SERIES[1], valeurs: serie(mesures.sale) },
          ]}
        />
      </div>
    </>
  )
}

// Un chiffre de la période et son écart avec la période précédente. `null` : pas de donnée.
function Indicateur({
  label,
  valeur,
  avant,
  format,
  unite,
  hausseMauvaise = false,
  periode,
}: {
  label: string
  valeur: number | null
  avant: number | null
  format: (valeur: number) => string
  // Unité de l'écart quand ce n'est pas celle de la valeur (points de pourcentage)
  unite?: string
  hausseMauvaise?: boolean
  periode: number
}) {
  const ecart = valeur !== null && avant !== null ? valeur - avant : null
  const bon = ecart !== null && ecart !== 0 && ecart > 0 !== hausseMauvaise

  return (
    <Card className="p-4!">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-50">{valeur === null ? '—' : format(valeur)}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {ecart === null ? (
          'Pas de comparaison possible'
        ) : ecart === 0 ? (
          `Stable sur ${periode} jours`
        ) : (
          <>
            {/* La flèche et le signe portent le sens ; la couleur ne fait que le souligner */}
            <span className={`font-medium ${bon ? 'text-emerald-400' : 'text-red-400'}`}>
              {ecart > 0 ? '▲ +' : '▼ −'}
              {unite ? `${formatNombre(Math.abs(ecart))} ${unite}` : format(Math.abs(ecart))}
            </span>{' '}
            vs les {periode} jours d’avant
          </>
        )}
      </p>
    </Card>
  )
}
