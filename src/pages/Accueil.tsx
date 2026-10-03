import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMembre } from '../auth/AuthContext'
import { Avatar, Button, Card, Chargement, ErrorMessage, RoleBadge } from '../components/ui'
import { supprimerAnnonce } from '../features/annonces/api'
import { NouvelleAnnonceDialog } from '../features/annonces/NouvelleAnnonceDialog'
import { useAnnonces } from '../features/annonces/useAnnonces'
import { basculerPresence } from '../features/members/api'
import { useMembres } from '../features/members/useMembres'
import { estPresent, useMaintenant } from '../lib/presence'
import { aAuMoins, estValide, formatDate, nomAffiche, rang } from '../lib/roles'
import type { Annonce, Membre } from '../types'

export function Accueil() {
  const membre = useMembre()
  const membres = useMembres()
  const estGrade = aAuMoins(membre.role, 'n2')
  const enAttente = membres.data.filter((m) => m.role === 'pending' && m.nomRP.trim()).length

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Bienvenue, {nomAffiche(membre)}</h1>
        <p className="text-sm text-zinc-400">Intranet des Ballas — 21 JumpClick</p>
      </header>

      {estGrade && enAttente > 0 && (
        <Link
          to="/membres"
          className="block rounded-xl border border-amber-800 bg-amber-950 px-5 py-3 text-sm text-amber-100 hover:bg-amber-900"
        >
          {enAttente} demande{enAttente > 1 ? 's' : ''} d’accès en attente de validation →
        </Link>
      )}

      <ErrorMessage>{membres.error}</ErrorMessage>

      {membres.loading ? (
        <Chargement />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Annonces membre={membre} membres={membres.data} />
          <Joueurs moi={membre} membres={membres.data} />
        </div>
      )}
    </>
  )
}

function Joueurs({ moi, membres }: { moi: Membre; membres: Membre[] }) {
  const maintenant = useMaintenant()
  const [erreur, setErreur] = useState<string | null>(null)
  const jeSuisPresent = estPresent(moi, maintenant)

  const joueurs = membres
    .filter((m) => estValide(m.role))
    .map((m) => ({ membre: m, present: estPresent(m, maintenant) }))
    .sort(
      (a, b) =>
        Number(b.present) - Number(a.present) ||
        rang(b.membre.role) - rang(a.membre.role) ||
        nomAffiche(a.membre).localeCompare(nomAffiche(b.membre), 'fr'),
    )
  const presents = joueurs.filter((j) => j.present).length

  function basculer() {
    setErreur(null)
    basculerPresence(moi.uid, !jeSuisPresent).catch((e: Error) => setErreur(e.message))
  }

  return (
    <Card
      title={`Joueurs · ${presents} présent${presents > 1 ? 's' : ''} / ${joueurs.length}`}
      action={
        <Button variant={jeSuisPresent ? 'ghost' : 'primary'} onClick={basculer}>
          {jeSuisPresent ? 'Je ne suis plus présent' : 'Je suis présent'}
        </Button>
      }
    >
      <ErrorMessage>{erreur}</ErrorMessage>
      <ul className="divide-y divide-zinc-800">
        {joueurs.map(({ membre, present }) => (
          <li key={membre.uid} className="flex items-center gap-3 py-2.5">
            <Avatar name={nomAffiche(membre)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{nomAffiche(membre)}</p>
              <RoleBadge role={membre.role} />
            </div>
            <div className="text-right text-sm">
              <p className={present ? 'font-medium text-emerald-400' : 'text-zinc-500'}>
                <span
                  className={`mr-1.5 inline-block size-2 rounded-full ${present ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                />
                {present ? 'Présent' : 'Absent'}
              </p>
              {present && membre.presenceAt && (
                <p className="text-xs text-zinc-500">
                  depuis {membre.presenceAt.toDate().toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Annonces({ membre, membres }: { membre: Membre; membres: Membre[] }) {
  const annonces = useAnnonces()
  const [saisie, setSaisie] = useState(false)
  const peutPublier = aAuMoins(membre.role, 'officier')

  return (
    <Card
      title="Annonces"
      action={
        peutPublier && (
          <Button aria-label="Ajouter une annonce" title="Ajouter une annonce" onClick={() => setSaisie(true)}>
            +
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <ErrorMessage>{annonces.error}</ErrorMessage>
        {annonces.loading && <Chargement />}
        {!annonces.loading && annonces.data.length === 0 && (
          <p className="text-sm text-zinc-500">Aucune annonce pour le moment.</p>
        )}
        {annonces.data.map((a) => (
          <AnnonceItem
            key={a.id}
            annonce={a}
            membre={membre}
            // Nom RP actuel de l'auteur, jamais le nom enregistré avec l'annonce (il a pu précéder le nom RP)
            auteur={nomAffiche(membres.find((m) => m.uid === a.auteurUid))}
          />
        ))}
      </div>
      {saisie && <NouvelleAnnonceDialog membre={membre} onClose={() => setSaisie(false)} />}
    </Card>
  )
}

function AnnonceItem({ annonce, membre, auteur }: { annonce: Annonce; membre: Membre; auteur: string }) {
  const peutSupprimer =
    aAuMoins(membre.role, 'n2') || (membre.role === 'officier' && annonce.auteurUid === membre.uid)

  function supprimer() {
    if (window.confirm(`Supprimer l’annonce « ${annonce.titre} » ?`)) {
      supprimerAnnonce(annonce.id).catch((e: Error) => window.alert(e.message))
    }
  }

  return (
    <article className="border-l-2 border-purple-700 pl-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-100">{annonce.titre}</h3>
        {peutSupprimer && (
          <Button variant="danger" className="shrink-0 px-2 py-0.5 text-xs" onClick={supprimer}>
            Supprimer
          </Button>
        )}
      </div>
      {annonce.contenu && <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-300">{annonce.contenu}</p>}
      <p className="mt-1 text-xs text-zinc-500">
        {auteur} · {formatDate(annonce.createdAt, true)}
      </p>
    </article>
  )
}
