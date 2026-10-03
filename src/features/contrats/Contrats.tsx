import { useState } from 'react'
import { Button, Card, Chargement, ErrorMessage } from '../../components/ui'
import { formatPrix } from '../../lib/format'
import { useMaintenant } from '../../lib/presence'
import { aAuMoins } from '../../lib/roles'
import type { Contrat, Membre } from '../../types'
import { echeanceCourante, etatContrat, marquerPaye, type EtatContrat } from './api'
import { ContratModal } from './ContratModal'
import { useContrats } from './useContrats'

// Vert : payé. Orange : échéance dans moins d'une journée. Rouge : délai dépassé.
const ETATS: Record<EtatContrat, { label: string; barre: string; texte: string }> = {
  paye: { label: 'Payé', barre: 'border-l-emerald-500 bg-emerald-950/30', texte: 'text-emerald-400' },
  proche: { label: 'Échéance proche', barre: 'border-l-amber-500 bg-amber-950/30', texte: 'text-amber-400' },
  retard: { label: 'Délai dépassé', barre: 'border-l-red-500 bg-red-950/30', texte: 'text-red-400' },
  a_venir: { label: 'À payer', barre: 'border-l-zinc-600', texte: 'text-zinc-400' },
}

// « vendredi 9 octobre à 21:00 », ou sans l'heure quand seule la date compte
function formatEcheance(contrat: Contrat, echeance: number): string {
  const date = new Date(echeance)
  const jour = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return contrat.heureFixee ? `${jour} à ${date.toLocaleTimeString('fr-FR', { timeStyle: 'short' })}` : jour
}

// Sommes que le groupe doit payer. Tout le monde les voit ; les gradés (Admin, N1, N2) les gèrent.
export function Contrats({ membre }: { membre: Membre }) {
  const contrats = useContrats()
  // Réévalué chaque minute : un contrat passe à l'orange puis au rouge sans recharger la page,
  // et un contrat hebdomadaire payé repasse « à payer » une fois son échéance passée
  const maintenant = useMaintenant()
  // `null` : fenêtre fermée ; `{}` : ajout ; `{ contrat }` : modification
  const [fenetre, setFenetre] = useState<{ contrat?: Contrat } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const estGrade = aAuMoins(membre, 'n2')

  // Les contrats à payer d'abord, du plus urgent au plus lointain, puis ceux déjà payés
  const tries = contrats.data
    .map((contrat) => ({ contrat, ...echeanceCourante(contrat, maintenant) }))
    .sort((a, b) => Number(a.paye) - Number(b.paye) || a.echeance - b.echeance)
  const reste = tries.filter((c) => !c.paye).reduce((total, c) => total + c.contrat.montant, 0)

  return (
    <Card
      className="p-4!"
      title="Contrats en cours"
      action={
        estGrade && (
          <Button aria-label="Ajouter un contrat" title="Ajouter un contrat" onClick={() => setFenetre({})}>
            +
          </Button>
        )
      }
    >
      <ErrorMessage>{contrats.error ?? erreur}</ErrorMessage>
      {contrats.loading ? (
        <Chargement />
      ) : tries.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun contrat en cours.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {tries.map(({ contrat, echeance, paye }) => {
              const etat = ETATS[etatContrat(contrat, maintenant)]
              return (
                <li
                  key={contrat.id}
                  className={`rounded-md border-l-4 px-3 py-2 ${etat.barre}`}
                  // L'état et l'échéance ne sont plus écrits sur la ligne : la couleur les porte, l'infobulle les détaille
                  title={`${etat.label} · ${formatEcheance(contrat, echeance)}${contrat.hebdo ? ' · chaque semaine' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    {estGrade ? (
                      <button
                        type="button"
                        title="Modifier le contrat"
                        className="min-w-0 truncate text-left text-sm font-medium text-zinc-100 hover:underline"
                        onClick={() => setFenetre({ contrat })}
                      >
                        {contrat.libelle}
                      </button>
                    ) : (
                      <p className="min-w-0 truncate text-sm font-medium text-zinc-100">{contrat.libelle}</p>
                    )}
                    <span className={`text-sm font-semibold whitespace-nowrap tabular-nums ${etat.texte}`}>
                      {formatPrix(contrat.montant)}
                    </span>
                  </div>
                  {contrat.note && <p className="text-xs text-zinc-500">{contrat.note}</p>}
                  {estGrade && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-purple-300 hover:underline"
                      onClick={() => {
                        setErreur(null)
                        marquerPaye(contrat, maintenant, !paye).catch((e: Error) => setErreur(e.message))
                      }}
                    >
                      {paye ? 'Marquer non payé' : 'Marquer payé'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-right text-sm text-zinc-400">
            Reste à payer : <span className="font-semibold text-zinc-100 tabular-nums">{formatPrix(reste)}</span>
          </p>
        </>
      )}
      {fenetre && <ContratModal contrat={fenetre.contrat} onClose={() => setFenetre(null)} />}
    </Card>
  )
}
