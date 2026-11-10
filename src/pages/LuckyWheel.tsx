import { useState, type FormEvent } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage, inputClass } from '../components/ui'
import { useMembres } from '../features/members/useMembres'
import { enregistrerTirage, useTirages } from '../features/roue/api'
import { Roue } from '../features/roue/Roue'
import { comparerPartenaires } from '../features/tarifs/api'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { formatNombre } from '../lib/format'
import { CASES_ROUE, appliquerCase, decalageAleatoire, estGain, tirerCase } from '../lib/roue'
import { formatDate, nomAffiche } from '../lib/roles'

const ANGLE = 360 / CASES_ROUE.length
// Durée de la rotation, alignée sur la transition de la roue
const DUREE_MS = 5600
const HISTORIQUE_MAX = 30

// Roue de la chance : un groupe à qui l'on doit des pochons tente de faire monter, ou descendre, ce qui lui est dû.
// Le stock n'est pas touché ; chaque tour est enregistré dès le tirage, avant que la roue s'arrête.
export function LuckyWheel() {
  const moi = useMembre()
  const tirages = useTirages()
  const partenaires = usePartenaires()
  const membres = useMembres()
  const [quantite, setQuantite] = useState('')
  const [partenaireId, setPartenaireId] = useState('')
  const [rotation, setRotation] = useState(0)
  const [enRotation, setEnRotation] = useState(false)
  // Dernier tour, affiché une fois la roue arrêtée
  const [resultat, setResultat] = useState<{ quantite: number; caseIndex: number; groupe: string } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const groupes = partenaires.data.filter((p) => p.type !== 'pm').sort(comparerPartenaires)
  const nombre = Math.trunc(Number(quantite))
  const valide = quantite !== '' && nombre >= 1 && nombre <= 1_000_000

  async function tourner(e: FormEvent) {
    e.preventDefault()
    if (!valide || enRotation) return
    setErreur(null)
    setResultat(null)
    const caseIndex = tirerCase()
    const groupe = groupes.find((p) => p.id === partenaireId)
    try {
      await enregistrerTirage(nombre, groupe ? { id: groupe.id, nom: groupe.nom } : null, caseIndex, moi.uid)
    } catch (err) {
      setErreur((err as Error).message)
      return
    }
    // Au moins cinq tours complets, puis la case tirée sous le repère, pas toujours pile au centre
    const cible = (360 - caseIndex * ANGLE) % 360
    const decalage = decalageAleatoire() * ANGLE * 0.6
    const actuel = ((rotation % 360) + 360) % 360
    setEnRotation(true)
    setRotation(rotation + 5 * 360 + ((cible - actuel + 360) % 360) + decalage)
    setTimeout(() => {
      setEnRotation(false)
      setResultat({ quantite: nombre, caseIndex, groupe: groupe?.nom ?? '' })
    }, DUREE_MS)
  }

  const historique = [...tirages.data]
    .sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity))
    .slice(0, HISTORIQUE_MAX)

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Lucky Wheel</h1>
        <p className="text-sm text-zinc-400">
          Un groupe à qui l’on doit des pochons peut tenter sa chance : la roue multiplie, divise ou ajoute. Le stock
          n’est pas touché.
        </p>
      </header>

      <ErrorMessage>{erreur ?? tirages.error ?? partenaires.error}</ErrorMessage>

      {/* La roue au centre, grande ; la saisie sur une ligne au-dessus ; l'historique dessous */}
      <div className="space-y-6">
        <Card>
          <form onSubmit={tourner} className="mx-auto flex max-w-2xl flex-wrap items-end justify-center gap-3">
            <label className="block w-full space-y-1 text-sm sm:w-56">
              <span className="text-zinc-400">Groupe (facultatif)</span>
              <select
                className={inputClass}
                value={partenaireId}
                disabled={enRotation}
                onChange={(e) => setPartenaireId(e.target.value)}
              >
                <option value="">—</option>
                {groupes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-full space-y-1 text-sm sm:w-36">
              <span className="text-zinc-400">Pochons dus</span>
              <input
                type="number"
                className={inputClass}
                value={quantite}
                min={1}
                step={1}
                required
                disabled={enRotation}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </label>
            <Button type="submit" className="w-full px-6 py-2 sm:w-auto" disabled={!valide || enRotation}>
              {enRotation ? 'La roue tourne…' : 'Tourner la roue'}
            </Button>
          </form>

          <div className="mt-8">
            <Roue rotation={rotation} enRotation={enRotation} />
          </div>

          {resultat && (
            <div
              className={`mx-auto mt-8 max-w-md rounded-lg border p-4 text-center ${
                estGain(CASES_ROUE[resultat.caseIndex])
                  ? 'border-purple-600 bg-purple-950/50'
                  : 'border-zinc-700 bg-zinc-950'
              }`}
            >
              <p className="text-sm text-zinc-400">
                {resultat.groupe && `${resultat.groupe} · `}
                {formatNombre(resultat.quantite)} pochons × case{' '}
                <span className="font-semibold text-zinc-100">{CASES_ROUE[resultat.caseIndex].libelle}</span>
              </p>
              <p className="mt-1 text-3xl font-semibold text-zinc-50 tabular-nums">
                {formatNombre(appliquerCase(resultat.quantite, CASES_ROUE[resultat.caseIndex]))} pochons
              </p>
            </div>
          )}
        </Card>

        <Card title="Derniers tours">
          {tirages.loading ? (
            <Chargement />
          ) : historique.length === 0 ? (
            <p className="text-sm text-zinc-500">La roue n’a pas encore tourné.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs tracking-wide text-zinc-500 uppercase">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Groupe</th>
                    <th className="pb-2 text-right font-medium">Dû</th>
                    <th className="pb-2 pl-4 font-medium">Case</th>
                    <th className="pb-2 text-right font-medium">Résultat</th>
                    <th className="pb-2 pl-4 font-medium">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {historique.map((t) => {
                    // Le tour en cours n'est révélé qu'une fois la roue arrêtée
                    const cache = enRotation && t === historique[0] && t.parUid === moi.uid
                    return (
                      <tr key={t.id}>
                        <td className="py-2 pr-4 whitespace-nowrap text-zinc-400">{formatDate(t.createdAt, true)}</td>
                        <td className="py-2 pr-4 text-zinc-100">{t.partenaireNom || '—'}</td>
                        <td className="py-2 text-right text-zinc-300 tabular-nums">{formatNombre(t.quantite)}</td>
                        <td className="py-2 pl-4 font-semibold text-zinc-100">{cache ? '…' : t.libelle}</td>
                        <td className="py-2 text-right font-semibold text-zinc-50 tabular-nums">
                          {cache ? '…' : formatNombre(t.resultat)}
                        </td>
                        <td className="py-2 pl-4 whitespace-nowrap text-zinc-400">
                          {nomAffiche(membres.data.find((m) => m.uid === t.parUid))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
