import { useEffect, useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Avatar, Button, Card, Chargement, ErrorMessage, RoleBadge, inputClass } from '../components/ui'
import { changerRole, lireEmailPrive, revoquer, supprimerJoueur } from '../features/members/api'
import { SortieModal } from '../features/members/SortieModal'
import { useMembres } from '../features/members/useMembres'
import {
  ROLE_LABELS,
  aAuMoins,
  estValide,
  formatDate,
  nomAffiche,
  peutGerer,
  rang,
  rolesAttribuables,
} from '../lib/roles'
import { RAISON_LABELS, RAISONS_REVOCATION, RAISONS_SUPPRESSION, estSuppression } from '../lib/sorties'
import type { Membre, RaisonSortie, Role } from '../types'

export function Membres() {
  const moi = useMembre()
  const { data, loading, error } = useMembres()
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const [sortie, setSortie] = useState<{ cible: Membre; raisons: Exclude<RaisonSortie, 'refus'>[] } | null>(null)
  const estGrade = aAuMoins(moi.role, 'n2')
  const estAdmin = moi.role === 'admin'
  const roles = rolesAttribuables(moi.role)

  const valides = data
    .filter((m) => estValide(m.role))
    .sort((a, b) => rang(b.role) - rang(a.role) || nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))
  // Une demande n'est présentée qu'une fois le nom RP renseigné
  const enAttente = data.filter((m) => m.role === 'pending' && m.nomRP.trim())
  const revoques = data.filter((m) => m.role === 'revoque')

  async function executer(action: () => Promise<void>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return
    setErreurAction(null)
    try {
      await action()
    } catch (e) {
      setErreurAction((e as Error).message)
    }
  }

  const appliquer = (cible: Membre, role: Exclude<Role, 'revoque'>, confirmation?: string) =>
    executer(() => changerRole(moi, cible, role), confirmation)

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Membres</h1>
        <p className="text-sm text-zinc-400">
          {valides.length} membre{valides.length > 1 ? 's' : ''} dans le groupe
        </p>
      </header>

      <ErrorMessage>{error ?? erreurAction}</ErrorMessage>

      {estGrade && enAttente.length > 0 && (
        <Card title="Demandes en attente">
          <ul className="divide-y divide-zinc-800">
            {enAttente.map((m) => (
              <li key={m.uid} className="flex flex-wrap items-center gap-3 py-3">
                <Identite membre={m} avecEmail={estAdmin} />
                <span className="text-xs text-zinc-500">Demande du {formatDate(m.createdAt)}</span>
                <div className="ml-auto flex gap-2">
                  <Button onClick={() => appliquer(m, 'membre')}>Valider</Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      executer(() => revoquer(moi, m, 'refus'), `Refuser la demande de ${nomAffiche(m)} ?`)
                    }
                  >
                    Refuser
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Effectif">
        {loading ? (
          <Chargement />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-2 font-medium">Membre</th>
                  <th className="pb-2 font-medium">Téléphone</th>
                  <th className="pb-2 font-medium">Grade</th>
                  <th className="pb-2 font-medium">Arrivée</th>
                  {estGrade && <th className="pb-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {valides.map((m) => (
                  <tr key={m.uid}>
                    <td className="py-2.5 pr-4">
                      <Identite membre={m} avecEmail={estAdmin} />
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-300">{m.telephoneRP || '—'}</td>
                    <td className="py-2.5 pr-4">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-400">{formatDate(m.validatedAt ?? m.createdAt)}</td>
                    {estGrade && (
                      <td className="py-2.5">
                        {!peutGerer(moi, m) ? (
                          <span className="text-xs text-zinc-600">{m.uid === moi.uid ? 'Toi' : '—'}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Grade de ${nomAffiche(m)}`}
                              className={`${inputClass} w-auto py-1`}
                              value={m.role}
                              onChange={(e) => {
                                const role = e.target.value as Exclude<Role, 'revoque'>
                                appliquer(m, role, `Passer ${nomAffiche(m)} au grade ${ROLE_LABELS[role]} ?`)
                              }}
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="danger"
                              onClick={() =>
                                setSortie({ cible: m, raisons: [...RAISONS_REVOCATION, ...RAISONS_SUPPRESSION] })
                              }
                            >
                              Retirer
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {estGrade && revoques.length > 0 && (
        <Card title="Comptes refusés ou révoqués">
          <ul className="divide-y divide-zinc-800">
            {revoques.map((m) => (
              <li key={m.uid} className="flex flex-wrap items-center gap-3 py-3">
                <Identite membre={m} avecEmail={estAdmin} />
                <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
                  {m.raisonRevocation ? RAISON_LABELS[m.raisonRevocation] : 'Révoqué'}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      appliquer(m, 'membre', `Réintégrer ${nomAffiche(m)} comme ${ROLE_LABELS.membre} ?`)
                    }
                  >
                    Réintégrer
                  </Button>
                  <Button variant="danger" onClick={() => setSortie({ cible: m, raisons: RAISONS_SUPPRESSION })}>
                    Supprimer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sortie && (
        <SortieModal
          cible={sortie.cible}
          raisons={sortie.raisons}
          onClose={() => setSortie(null)}
          onConfirm={(raison) =>
            estSuppression(raison) ? supprimerJoueur(moi, sortie.cible, raison) : revoquer(moi, sortie.cible, raison)
          }
        />
      )}
    </>
  )
}

function Identite({ membre, avecEmail }: { membre: Membre; avecEmail: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={nomAffiche(membre)} />
      <div className="min-w-0">
        <p className="truncate font-medium text-zinc-100">{nomAffiche(membre)}</p>
        {avecEmail && <EmailPrive uid={membre.uid} />}
      </div>
    </div>
  )
}

// Rendu uniquement pour l'admin : les règles refusent cette lecture à tout autre grade
function EmailPrive({ uid }: { uid: string }) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    lireEmailPrive(uid)
      .then((valeur) => actif && setEmail(valeur))
      .catch(() => actif && setEmail(null))
    return () => {
      actif = false
    }
  }, [uid])

  if (!email) return null
  return (
    <p className="truncate text-xs text-zinc-500" title="Visible par l’admin uniquement">
      {email}
    </p>
  )
}
