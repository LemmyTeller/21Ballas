import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMembre } from '../auth/AuthContext'
import { VERSION } from '../changelog'
import { ChangelogModal } from '../components/ChangelogModal'
import { Avatar, Button, Logo, RoleBadge } from '../components/ui'
import { auth } from '../lib/firebase'
import { aAuMoins, nomAffiche } from '../lib/roles'
import type { Role } from '../types'

const LIENS: { to: string; label: string; minimum: Role }[] = [
  { to: '/', label: 'Accueil', minimum: 'membre' },
  { to: '/membres', label: 'Membres', minimum: 'membre' },
  { to: '/gestion', label: 'Gestion', minimum: 'membre' },
  { to: '/stock', label: 'Stock', minimum: 'membre' },
  { to: '/inventaire', label: 'Inventaire', minimum: 'n2' },
  { to: '/journal', label: 'Journal', minimum: 'n2' },
]

const A_VENIR = ['Commerce']

// Pages en grille de cartes, qui profitent de toute la largeur de l'écran
const PAGES_LARGES = ['/stock']

const lienBase = 'block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors'

export function AppLayout() {
  const membre = useMembre()
  const { pathname } = useLocation()
  const [changelog, setChangelog] = useState(false)

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Sur grand écran le menu reste fixé à la hauteur de la fenêtre : seul le contenu défile */}
      <aside className="flex shrink-0 flex-col gap-4 border-b border-zinc-800 bg-zinc-900 p-4 md:sticky md:top-0 md:h-svh md:w-60 md:self-start md:overflow-y-auto md:border-r md:border-b-0">
        <Logo className="size-12 md:size-16" />
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {LIENS.filter((l) => aAuMoins(membre.role, l.minimum)).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `${lienBase} ${isActive ? 'bg-purple-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {A_VENIR.map((label) => (
            <span key={label} className={`${lienBase} cursor-default text-zinc-600`} title="Bientôt disponible">
              {label} <span className="text-xs">· à venir</span>
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 md:flex-col md:items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar name={nomAffiche(membre)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{nomAffiche(membre)}</p>
              <RoleBadge role={membre.role} />
            </div>
            <NavLink
              to="/profil"
              aria-label="Paramètres"
              title="Paramètres"
              className={({ isActive }) =>
                `self-end rounded-md p-1 transition-colors ${
                  isActive ? 'bg-purple-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </NavLink>
          </div>
          <Button variant="ghost" onClick={() => signOut(auth)}>
            Déconnexion
          </Button>
          <button
            type="button"
            title="Journal des versions"
            className="text-xs text-zinc-500 hover:text-purple-300 md:text-center"
            onClick={() => setChangelog(true)}
          >
            v{VERSION}
          </button>
        </div>
      </aside>
      {changelog && <ChangelogModal onClose={() => setChangelog(false)} />}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className={`mx-auto space-y-6 ${PAGES_LARGES.includes(pathname) ? 'max-w-[110rem]' : 'max-w-5xl'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
