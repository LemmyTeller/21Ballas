import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMembre } from '../auth/AuthContext'
import { Avatar, Button, Card, Chargement, ErrorMessage, RoleBadge } from '../components/ui'
import { Biz } from '../features/accueil/Biz'
import { Emplacement } from '../features/accueil/Emplacement'
import { RecidivesEnCours } from '../features/amendes/RecidivesEnCours'
import { supprimerAnnonce } from '../features/annonces/api'
import { NouvelleAnnonceDialog } from '../features/annonces/NouvelleAnnonceDialog'
import { useAnnonces } from '../features/annonces/useAnnonces'
import { BlanchimentsEnCours } from '../features/blanchiment/BlanchimentsEnCours'
import { Contrats } from '../features/contrats/Contrats'
import { basculerPresence } from '../features/members/api'
import { useMembres } from '../features/members/useMembres'
import { SaisieJournaliere } from '../features/saisie/SaisieJournaliere'
import { Taches } from '../features/taches/Taches'
import {
  LARGEURS,
  enregistrerDisposition,
  enregistrerLargeurs,
  lireDisposition,
  lireLargeurs,
  type Encart,
  type Largeur,
} from '../lib/preferences'
import { estPresent, useMaintenant } from '../lib/presence'
import { aAuMoins, estValide, formatDate, nomAffiche, rang } from '../lib/roles'
import type { Annonce, Membre } from '../types'

export function Accueil() {
  const membre = useMembre()
  const membres = useMembres()
  const estGrade = aAuMoins(membre, 'n2')
  const enAttente = membres.data.filter((m) => m.role === 'pending' && m.nomRP.trim()).length

  // Disposition propre au joueur : `disposition[i]` est l'encart affiché dans l'emplacement i
  const [disposition, setDisposition] = useState(lireDisposition)
  const [edition, setEdition] = useState(false)
  // Emplacement de l'encart en cours de déplacement, et celui qu'il survole
  const [choisi, setChoisi] = useState<number | null>(null)
  const [survole, setSurvole] = useState<number | null>(null)

  function echanger(a: number, b: number) {
    if (a === b) return
    const suivante = [...disposition]
    ;[suivante[a], suivante[b]] = [suivante[b], suivante[a]]
    setDisposition(suivante)
    enregistrerDisposition(suivante)
  }

  // Fin d'un déplacement, au dépôt ou à la deuxième touche
  function placer(emplacement: number) {
    if (choisi !== null) echanger(choisi, emplacement)
    setChoisi(null)
    setSurvole(null)
  }

  // Largeur de chaque encart : elle le suit quand il change de place
  const [largeurs, setLargeurs] = useState(lireLargeurs)

  function reglerLargeur(encart: Encart, largeur: Largeur) {
    const suivantes = { ...largeurs, [encart]: largeur }
    setLargeurs(suivantes)
    enregistrerLargeurs(suivantes)
  }

  function reinitialiser() {
    enregistrerDisposition(null)
    enregistrerLargeurs(null)
    setDisposition(lireDisposition())
    setLargeurs(lireLargeurs())
    setChoisi(null)
  }

  // Colonne de grille d'un emplacement ; pour deux encarts l'un sur l'autre, le plus large des deux l'emporte
  const ORDRE: Largeur[] = ['etroit', 'moyen', 'large', 'auto']
  const colonne = (...emplacements: number[]) => {
    const rangs = emplacements.map((i) => ORDRE.indexOf(largeurs[disposition[i]]))
    return LARGEURS[ORDRE[Math.max(...rangs)]].colonne
  }
  // Variables lues par les classes de grille : elles ne s'appliquent que sur grand écran, où les encarts sont côte à côte
  const colonnes = {
    '--haut': `${colonne(0)} ${colonne(1)} ${colonne(2)}`,
    '--bas': `${colonne(3)} ${colonne(4, 5)} ${colonne(7, 6)}`,
    '--bas-2': `${colonne(3)} ${colonne(4, 5)}`,
  } as CSSProperties

  const encarts: Record<Encart, { nom: string; contenu: ReactNode }> = {
    taches: { nom: 'Tâches', contenu: <Taches membre={membre} /> },
    annonces: { nom: 'Annonces', contenu: <Annonces membre={membre} membres={membres.data} /> },
    presents: { nom: 'Présents', contenu: <Joueurs moi={membre} membres={membres.data} /> },
    saisie: { nom: 'Saisie journalière', contenu: <SaisieJournaliere /> },
    recidives: { nom: 'Récidives', contenu: <RecidivesEnCours /> },
    blanchiment: { nom: 'Blanchiment', contenu: <BlanchimentsEnCours /> },
    contrats: { nom: 'Contrats', contenu: <Contrats membre={membre} /> },
    biz: { nom: 'Biz', contenu: <Biz /> },
  }

  const emplacement = (i: number) => {
    const encart = encarts[disposition[i]]
    return (
      <Emplacement
        key={disposition[i]}
        nom={encart.nom}
        edition={edition}
        choisi={choisi === i}
        survole={survole === i && choisi !== null && choisi !== i}
        largeur={largeurs[disposition[i]]}
        onLargeur={(largeur) => reglerLargeur(disposition[i], largeur)}
        onChoisir={() => (choisi === null ? setChoisi(i) : placer(i))}
        onGlisser={() => setChoisi(i)}
        onSurvoler={(dessus) => setSurvole(dessus ? i : null)}
        onDeposer={() => placer(i)}
      >
        {encart.contenu}
      </Emplacement>
    )
  }

  return (
    // Occupe au moins la hauteur de l'écran (moins les marges de la page), pour que la rangée du bas
    // reste calée en bas même quand le haut de la page est peu rempli
    <div className="flex flex-col gap-6 md:min-h-[calc(100svh-4rem)]" style={colonnes}>
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
        <>
          {/* Chaque joueur range les encarts à sa façon : en modification, ils échangent leurs places */}
          <div className="-mb-3 flex flex-wrap items-center justify-end gap-2">
            {edition ? (
              <>
                <p className="mr-auto text-sm text-zinc-400">
                  Glisse un encart sur un autre pour échanger leurs places, ou touche-les l’un après l’autre. La liste
                  en haut à droite de chaque encart règle sa largeur.
                </p>
                <Button variant="ghost" onClick={reinitialiser}>
                  Réinitialiser
                </Button>
                <Button
                  onClick={() => {
                    setEdition(false)
                    setChoisi(null)
                  }}
                >
                  Terminer
                </Button>
              </>
            ) : (
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-purple-300"
                onClick={() => setEdition(true)}
              >
                Disposition
              </button>
            )}
          </div>
          {/* Rangée du haut : trois emplacements, chacun de la largeur de l'encart qu'il porte */}
          <div className="grid items-start gap-6 lg:grid-cols-(--haut)">
            {emplacement(0)}
            {emplacement(1)}
            {emplacement(2)}
          </div>
          {/* Rangée du bas, calée en bas de page : trois colonnes, les deux dernières portant chacune deux encarts
              l'un sur l'autre. Sur écran moyen, la troisième passe à la ligne. */}
          <div className="mt-auto grid items-end gap-6 lg:grid-cols-(--bas-2) xl:grid-cols-(--bas)">
            {emplacement(3)}
            <div className="flex min-w-0 flex-col gap-6">
              {emplacement(4)}
              {emplacement(5)}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {emplacement(7)}
              {emplacement(6)}
            </div>
          </div>
        </>
      )}
    </div>
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
      className="p-4!"
      title={`${presents} / ${joueurs.length}`}
      action={
        <Button variant={jeSuisPresent ? 'ghost' : 'primary'} onClick={basculer}>
          {jeSuisPresent ? 'Je ne suis plus présent' : 'Je suis présent'}
        </Button>
      }
    >
      <ErrorMessage>{erreur}</ErrorMessage>
      <ul className="divide-y divide-zinc-800">
        {joueurs.map(({ membre, present }) => (
          <li key={membre.uid} className="flex items-center gap-3 py-2">
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
                  actif à {membre.presenceAt.toDate().toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
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
  const peutPublier = aAuMoins(membre, 'officier')

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
  const [modification, setModification] = useState(false)
  // Menu « ⋯ », ancré sous son bouton
  const [menu, setMenu] = useState<{ droite: number; haut: number } | null>(null)
  // Mêmes droits pour corriger une annonce que pour la supprimer : un gradé, ou le Masque violet qui l'a écrite
  const peutSupprimer =
    aAuMoins(membre, 'n2') || (membre.role === 'officier' && annonce.auteurUid === membre.uid)

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
          <button
            type="button"
            aria-label={`Actions pour l’annonce ${annonce.titre}`}
            aria-haspopup="menu"
            title="Actions"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={(e) => {
              const cadre = e.currentTarget.getBoundingClientRect()
              setMenu({ droite: window.innerWidth - cadre.right, haut: cadre.bottom + 4 })
            }}
          >
            ⋯
          </button>
        )}
      </div>
      {menu && (
        <>
          {/* Fond invisible : un clic ailleurs referme le menu */}
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenu(null)}
          />
          <div
            role="menu"
            className="fixed z-20 min-w-36 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl"
            style={{ right: menu.droite, top: menu.haut }}
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                setMenu(null)
                setModification(true)
              }}
            >
              Modifier
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-red-300 hover:bg-red-950"
              onClick={() => {
                setMenu(null)
                supprimer()
              }}
            >
              Supprimer
            </button>
          </div>
        </>
      )}
      {modification && (
        <NouvelleAnnonceDialog membre={membre} annonce={annonce} onClose={() => setModification(false)} />
      )}
      {annonce.contenu && <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-300">{annonce.contenu}</p>}
      <p className="mt-1 text-xs text-zinc-500">
        {auteur} · {formatDate(annonce.createdAt, true)}
      </p>
    </article>
  )
}
