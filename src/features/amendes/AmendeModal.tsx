import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Button, ErrorMessage, inputClass } from '../../components/ui'
import {
  CATEGORIES_DELIT,
  DELITS,
  categorieDelit,
  cleRecidive,
  finRecidive,
  nomDelit,
} from '../../lib/delits'
import { formatRestant } from '../../lib/format'
import { nomAffiche } from '../../lib/roles'
import type { Amende, Membre } from '../../types'
import { creerAmende, majAmende, supprimerAmende } from './api'

const deuxChiffres = (n: number) => String(n).padStart(2, '0')
// Valeurs des champs date et heure, dans le fuseau du navigateur
const versDate = (d: Date) => `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
const versHeure = (d: Date) => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`

// Nouvelle amende (joueur et délit éventuellement déjà choisis), ou correction d'une amende existante :
// dans ce cas seule la note se modifie.
export function AmendeModal({
  amende,
  initial,
  membres,
  recidives,
  maintenant,
  moi,
  onClose,
}: {
  amende?: Amende
  initial?: { membreUid: string; delit: string }
  membres: Membre[]
  // Récidives en cours, par joueur et délit (voir recidivesEnCours)
  recidives: Map<string, Amende>
  maintenant: number
  moi: Membre
  onClose: () => void
}) {
  const [membreUid, setMembreUid] = useState(initial?.membreUid ?? moi.uid)
  const [delit, setDelit] = useState(initial?.delit ?? DELITS[0].id)
  const [date, setDate] = useState(() => versDate(new Date()))
  const [heure, setHeure] = useState(() => versHeure(new Date()))
  // Tant que la date n'est pas touchée, l'amende est datée par le serveur
  const [dateModifiee, setDateModifiee] = useState(false)
  const [note, setNote] = useState(amende?.note ?? '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const enCours = amende ? undefined : recidives.get(cleRecidive(membreUid, delit))

  async function executer(action: () => Promise<void>) {
    setEnvoi(true)
    setErreur(null)
    try {
      await action()
      onClose()
    } catch (e) {
      setErreur((e as Error).message)
      setEnvoi(false)
    }
  }

  function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (amende) {
      executer(() => majAmende(amende.id, note))
      return
    }
    const membre = membres.find((m) => m.uid === membreUid)
    if (!membre) return
    const quand = dateModifiee ? new Date(`${date}T${heure || '00:00'}`) : null
    if (quand && quand.getTime() > Date.now()) {
      setErreur('Une amende ne peut pas être datée dans le futur.')
      return
    }
    executer(() => creerAmende({ membre, delit, date: quand, note }, moi.uid))
  }

  return (
    <Modal title={amende ? `Amende — ${amende.membreNom}` : 'Nouvelle amende'} onClose={onClose}>
      <form onSubmit={enregistrer} className="space-y-3">
        {amende ? (
          <p className="text-sm text-zinc-300">
            {nomDelit(amende.delit)}
            <span className="text-zinc-500">
              {' '}
              · {amende.date.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </p>
        ) : (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Joueur</span>
              <select className={inputClass} value={membreUid} onChange={(e) => setMembreUid(e.target.value)}>
                {membres.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {nomAffiche(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Délit</span>
              <select className={inputClass} value={delit} onChange={(e) => setDelit(e.target.value)}>
                {CATEGORIES_DELIT.map((c) => (
                  <optgroup key={c.id} label={c.nom}>
                    {DELITS.filter((d) => d.categorie === c.id).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nom}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {enCours ? (
              <p className="rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-100">
                Déjà en récidive sur ce délit (encore {formatRestant(finRecidive(enCours) - maintenant)}) : cette amende
                sera notée « Récidive » et relance le délai.
              </p>
            ) : (
              <p className="text-xs text-zinc-500 first-letter:uppercase">
                {CATEGORIES_DELIT.find((c) => c.id === categorieDelit(delit))?.delai}.
              </p>
            )}
          </>
        )}
        {!amende && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Date</span>
              <input
                type="date"
                className={inputClass}
                value={date}
                max={versDate(new Date(maintenant))}
                required
                onChange={(e) => {
                  setDate(e.target.value)
                  setDateModifiee(true)
                }}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Heure</span>
              <input
                type="time"
                className={inputClass}
                value={heure}
                required
                onChange={(e) => {
                  setHeure(e.target.value)
                  setDateModifiee(true)
                }}
              />
            </label>
          </div>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Note (facultatif)</span>
          <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex gap-2">
          {amende && (
            <Button
              variant="danger"
              disabled={envoi}
              onClick={() => {
                if (window.confirm('Supprimer cette amende ? La récidive qu’elle a ouverte disparaît avec elle.')) {
                  executer(() => supprimerAmende(amende.id))
                }
              }}
            >
              Supprimer
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
