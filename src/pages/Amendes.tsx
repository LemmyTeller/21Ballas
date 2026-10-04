import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { AmendeModal } from '../features/amendes/AmendeModal'
import { useAmendes } from '../features/amendes/useAmendes'
import { useMembres } from '../features/members/useMembres'
import {
  CATEGORIES_DELIT,
  DELITS,
  cleRecidive,
  estRecidive,
  finRecidive,
  formatRestant,
  nomDelit,
  recidivesEnCours,
} from '../lib/delits'
import { useMaintenant } from '../lib/presence'
import { aAuMoins, estValide, nomAffiche, rang } from '../lib/roles'
import type { Amende } from '../types'

const SEMAINE_MS = 7 * 24 * 3_600_000
// Lignes d'historique affichées d'un coup
const PAS_HISTORIQUE = 50

const formatQuand = (amende: Amende) =>
  amende.date.toDate().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

type Saisie = { amende: Amende } | { initial?: { membreUid: string; delit: string } }

export function Amendes() {
  const moi = useMembre()
  const membres = useMembres()
  const amendes = useAmendes()
  const maintenant = useMaintenant()
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [limite, setLimite] = useState(PAS_HISTORIQUE)
  const estGrade = aAuMoins(moi, 'n2')

  const valides = membres.data
    .filter((m) => estValide(m.role))
    .sort((a, b) => rang(b.role) - rang(a.role) || nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))
  const recidives = recidivesEnCours(amendes.data, maintenant)

  const nombreSemaine = amendes.data.filter((a) => a.date.toMillis() > maintenant - SEMAINE_MS).length
  const nombreParMembre = new Map<string, number>()
  for (const a of amendes.data) nombreParMembre.set(a.membreUid, (nombreParMembre.get(a.membreUid) ?? 0) + 1)

  const peutCorriger = (a: Amende) => estGrade || a.creeParUid === moi.uid || a.membreUid === moi.uid
  const nomDe = (uid: string) => {
    const membre = membres.data.find((m) => m.uid === uid)
    return membre ? nomAffiche(membre) : '—'
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Amendes</h1>
          <p className="text-sm text-zinc-400">
            Après une amende, le joueur est en récidive sur ce délit pendant 24 h.
          </p>
        </div>
        <Button onClick={() => setSaisie({})}>+ Amende</Button>
      </header>

      <ErrorMessage>{membres.error ?? amendes.error}</ErrorMessage>

      {membres.loading || amendes.loading ? (
        <Chargement />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Chiffre label="Récidives en cours" valeur={String(recidives.size)} alerte={recidives.size > 0} />
            <Chiffre label="Amendes des 7 derniers jours" valeur={String(nombreSemaine)} />
            <Chiffre label="Amendes depuis le début" valeur={String(amendes.data.length)} />
          </div>

          <Card className="p-4!">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-zinc-900" />
                    {CATEGORIES_DELIT.map((c) => (
                      <th
                        key={c.id}
                        colSpan={DELITS.filter((d) => d.categorie === c.id).length}
                        className="border border-zinc-800 bg-purple-900/60 px-2 py-1.5 text-sm font-semibold text-purple-50"
                      >
                        {c.nom}
                      </th>
                    ))}
                    <th />
                  </tr>
                  <tr>
                    <th className="sticky left-0 bg-zinc-900 px-2 py-1.5 text-left font-medium text-zinc-500 uppercase">
                      Membre
                    </th>
                    {DELITS.map((d) => (
                      <th
                        key={d.id}
                        title={d.nom}
                        className="w-[5.5rem] min-w-[4.5rem] border border-zinc-800 bg-purple-950/50 px-1 py-1.5 leading-tight font-medium text-zinc-200"
                      >
                        {d.court}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-medium text-zinc-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {valides.map((m) => (
                    <tr key={m.uid}>
                      <th className="sticky left-0 bg-zinc-900 px-2 py-1 text-left text-sm font-medium whitespace-nowrap text-zinc-100">
                        {nomAffiche(m)}
                      </th>
                      {DELITS.map((d) => {
                        const enCours = recidives.get(cleRecidive(m.uid, d.id))
                        const fin = enCours && finRecidive(enCours)
                        return (
                          <td key={d.id} className="border border-zinc-800 p-0">
                            <button
                              type="button"
                              aria-label={`${nomAffiche(m)} — ${d.nom}`}
                              title={
                                fin
                                  ? `${d.nom} : récidive jusqu’au ${new Date(fin).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                                  : `${d.nom} : noter une amende`
                              }
                              className={`block h-9 w-full font-semibold tabular-nums transition-colors ${
                                fin
                                  ? 'bg-purple-700 text-white hover:bg-purple-600'
                                  : 'text-transparent hover:bg-zinc-800 hover:text-zinc-500'
                              }`}
                              onClick={() => setSaisie({ initial: { membreUid: m.uid, delit: d.id } })}
                            >
                              {fin ? formatRestant(fin - maintenant) : '+'}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-2 py-1 text-right text-sm whitespace-nowrap text-zinc-300 tabular-nums">
                        {nombreParMembre.get(m.uid) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Case mauve : récidive en cours, avec le temps restant. Clique une case pour noter une amende.
            </p>
          </Card>

          <Card title="Historique">
            {amendes.data.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune amende enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Joueur</th>
                      <th className="pb-2 font-medium">Délit</th>
                      <th className="pb-2 font-medium">Note</th>
                      <th className="pb-2 font-medium">Saisie par</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {amendes.data.slice(0, limite).map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 whitespace-nowrap text-zinc-400 tabular-nums">{formatQuand(a)}</td>
                        <td className="py-2 pr-4 font-medium whitespace-nowrap text-zinc-100">{a.membreNom}</td>
                        <td className="py-2 pr-4 text-zinc-300">
                          {nomDelit(a.delit)}
                          {estRecidive(a, amendes.data) && (
                            <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-200">
                              Récidive
                            </span>
                          )}
                        </td>
                        <td className="max-w-64 truncate py-2 pr-4 text-zinc-400" title={a.note}>
                          {a.note || '—'}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap text-zinc-400">{nomDe(a.creeParUid)}</td>
                        <td className="py-2 text-right">
                          {peutCorriger(a) && (
                            <Button variant="ghost" className="py-1" onClick={() => setSaisie({ amende: a })}>
                              Modifier
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {amendes.data.length > limite && (
                  <div className="pt-3 text-center">
                    <Button variant="ghost" onClick={() => setLimite(limite + PAS_HISTORIQUE)}>
                      Afficher plus
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {saisie && (
        <AmendeModal
          amende={'amende' in saisie ? saisie.amende : undefined}
          initial={'initial' in saisie ? saisie.initial : undefined}
          membres={valides}
          recidives={recidives}
          maintenant={maintenant}
          moi={moi}
          onClose={() => setSaisie(null)}
        />
      )}
    </>
  )
}

function Chiffre({ label, valeur, alerte = false }: { label: string; valeur: string; alerte?: boolean }) {
  return (
    <Card className="p-4!">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alerte ? 'text-amber-300' : 'text-zinc-100'}`}>
        {valeur}
      </p>
    </Card>
  )
}
