import { Card, Chargement, ErrorMessage } from '../components/ui'
import { useLogs } from '../features/members/useLogs'
import { useMembres } from '../features/members/useMembres'
import { ROLE_LABELS, formatDate, nomAffiche } from '../lib/roles'
import { RAISON_LABELS } from '../lib/sorties'
import type { LogAction, LogEntry } from '../types'

const ACTION_LABELS: Record<LogAction, string> = {
  validation: 'Validation',
  refus: 'Refus',
  changement_role: 'Changement de grade',
  revocation: 'Révocation',
  reintegration: 'Réintégration',
  suppression: 'Suppression',
}

// Avant cette date, le journal a pu enregistrer un nom de compte à la place du nom RP :
// ces noms enregistrés ne sont jamais réaffichés.
const NOMS_RP_DEPUIS = new Date('2026-10-03T00:00:00').getTime()

export function Journal() {
  const { data, loading, error } = useLogs()
  const membres = useMembres()

  // Nom RP actuel du joueur ; s'il a été supprimé, le nom RP enregistré dans le journal
  function nom(log: LogEntry, uid: string, enregistre: string) {
    const membre = membres.data.find((m) => m.uid === uid)
    if (membre) return nomAffiche(membre)
    // createdAt est null le temps que le serveur confirme une entrée qui vient d'être écrite
    const fiable = !log.createdAt || log.createdAt.toMillis() >= NOMS_RP_DEPUIS
    return fiable && enregistre ? enregistre : 'Joueur supprimé'
  }

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Journal</h1>
        <p className="text-sm text-zinc-400">
          Historique des validations, changements de grade, révocations et suppressions (non modifiable)
        </p>
      </header>
      <ErrorMessage>{error ?? membres.error}</ErrorMessage>
      <Card>
        {loading || membres.loading ? (
          <Chargement />
        ) : data.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune action enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Membre</th>
                  <th className="pb-2 font-medium">Grade</th>
                  <th className="pb-2 font-medium">Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-zinc-400">{formatDate(log.createdAt, true)}</td>
                    <td className="py-2.5 pr-4 text-zinc-100">
                      {ACTION_LABELS[log.action] ?? log.action}
                      {log.raison && log.raison !== 'refus' && (
                        <span className="text-zinc-400"> · {RAISON_LABELS[log.raison] ?? log.raison}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-100">{nom(log, log.cibleUid, log.cibleNom)}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">
                      {ROLE_LABELS[log.ancienRole] ?? log.ancienRole} →{' '}
                      {log.action === 'suppression' ? 'Supprimé' : (ROLE_LABELS[log.nouveauRole] ?? log.nouveauRole)}
                    </td>
                    <td className="py-2.5 text-zinc-300">{nom(log, log.acteurUid, log.acteurNom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
