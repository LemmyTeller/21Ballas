import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { Button, Card, Chargement, ErrorMessage, inputClass } from '../../components/ui'
import { aAuMoins } from '../../lib/roles'
import type { Membre, Tache } from '../../types'
import { useCarjackings } from '../carjacking/useCarjackings'
import { cocherTache, creerTache, echangerTaches, supprimerTache } from './api'
import { useTaches } from './useTaches'

// Tâches du groupe, de la plus prioritaire à la moins prioritaire. Tout le monde lit et coche ;
// les gradés (Admin, N1, N2) ajoutent, réordonnent et suppriment.
export function Taches({ membre }: { membre: Membre }) {
  const taches = useTaches()
  // Nombre de voitures en attente d'être volées, pour la tâche automatique
  const aVoler = useCarjackings().data.filter((c) => c.statut === 'a_voler').length
  const [saisie, setSaisie] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const estGrade = aAuMoins(membre, 'n2')

  // Les tâches réalisées descendent en bas de liste, sans perdre leur ordre entre elles
  const aFaire = taches.data.filter((t) => !t.fait)
  const faites = taches.data.filter((t) => t.fait)
  const prochainOrdre = Math.max(0, ...taches.data.map((t) => t.ordre)) + 1

  const agir = (action: Promise<void>) => {
    setErreur(null)
    action.catch((e: Error) => setErreur(e.message))
  }

  function ligne(tache: Tache, index: number) {
    return (
      <li key={tache.id} className="flex items-start gap-3 py-2">
        <Coche fait={tache.fait} titre={tache.titre} onClick={() => agir(cocherTache(tache.id, !tache.fait))} />
        <p className={`min-w-0 flex-1 pt-0.5 text-sm break-words ${tache.fait ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
          {tache.titre}
        </p>
        {estGrade && (
          <div className="flex shrink-0 items-center gap-0.5">
            {!tache.fait && (
              <>
                <Fleche
                  sens="haut"
                  disabled={index === 0}
                  onClick={() => agir(echangerTaches(tache, aFaire[index - 1]))}
                />
                <Fleche
                  sens="bas"
                  disabled={index === aFaire.length - 1}
                  onClick={() => agir(echangerTaches(tache, aFaire[index + 1]))}
                />
              </>
            )}
            <button
              type="button"
              aria-label={`Supprimer la tâche ${tache.titre}`}
              title="Supprimer"
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-red-950 hover:text-red-300"
              onClick={() => window.confirm(`Supprimer la tâche « ${tache.titre} » ?`) && agir(supprimerTache(tache.id))}
            >
              ✕
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <Card
      title="Tâches"
      action={
        estGrade && (
          <Button aria-label="Ajouter une tâche" title="Ajouter une tâche" onClick={() => setSaisie(true)}>
            +
          </Button>
        )
      }
    >
      <ErrorMessage>{taches.error ?? erreur}</ErrorMessage>
      {taches.loading ? (
        <Chargement />
      ) : taches.data.length === 0 && aVoler === 0 ? (
        <p className="text-sm text-zinc-500">Aucune tâche pour le moment.</p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {/* Tâche automatique, toujours en tête : présente tant qu'au moins une voiture est à voler dans
              Carjacking, elle disparaît toute seule ensuite. Elle ne se coche pas et ne se supprime pas. */}
          {aVoler > 0 && (
            <li className="flex items-start gap-3 py-2">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-md border-2 border-amber-500 text-sm font-bold text-amber-400"
              >
                !
              </span>
              <Link to="/carjacking" className="min-w-0 flex-1 pt-0.5 text-sm text-zinc-100 hover:underline">
                Vol de véhicule demandé
                <span className="text-zinc-400">
                  {' '}
                  · {aVoler} voiture{aVoler > 1 ? 's' : ''} à voler
                </span>
              </Link>
            </li>
          )}
          {aFaire.map(ligne)}
          {faites.map(ligne)}
        </ul>
      )}
      {saisie && <NouvelleTache auteurUid={membre.uid} ordre={prochainOrdre} onClose={() => setSaisie(false)} />}
    </Card>
  )
}

// Case à cocher bien visible : pleine et violette une fois la tâche réalisée
function Coche({ fait, titre, onClick }: { fait: boolean; titre: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={fait}
      aria-label={`Tâche réalisée : ${titre}`}
      className={`flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors hover:border-purple-400 ${
        fait ? 'border-purple-500 bg-purple-600 text-white' : 'border-zinc-600 text-transparent'
      }`}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Fleche({ sens, disabled, onClick }: { sens: 'haut' | 'bas'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={sens === 'haut' ? 'Monter la priorité' : 'Baisser la priorité'}
      title={sens === 'haut' ? 'Monter' : 'Descendre'}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-25 disabled:hover:bg-transparent"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d={sens === 'haut' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function NouvelleTache({ auteurUid, ordre, onClose }: { auteurUid: string; ordre: number; onClose: () => void }) {
  const [titre, setTitre] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await creerTache(auteurUid, titre, ordre)
      onClose()
    } catch (err) {
      setErreur((err as Error).message)
      setEnvoi(false)
    }
  }

  return (
    <Modal title="Nouvelle tâche" onClose={onClose}>
      <form onSubmit={ajouter} className="space-y-3">
        <input
          className={inputClass}
          placeholder="Tâche à réaliser"
          value={titre}
          maxLength={200}
          required
          autoFocus
          onChange={(e) => setTitre(e.target.value)}
        />
        <ErrorMessage>{erreur}</ErrorMessage>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={envoi || !titre.trim()}>
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
