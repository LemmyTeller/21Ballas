import type { ButtonHTMLAttributes, ReactNode } from 'react'
import logo from '../assets/B-ballas.webp'
import logoChargement from '../assets/Ballas_logo.png'
import { ROLE_LABELS } from '../lib/roles'
import type { Role } from '../types'

type Variant = 'primary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-purple-700 text-white hover:bg-purple-600',
  ghost: 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800',
  danger: 'border border-red-900 text-red-300 hover:bg-red-950',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-l-4 border-zinc-800 border-l-purple-600 bg-zinc-900 p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

const ROLE_STYLES: Record<Role, string> = {
  admin: 'bg-fuchsia-600 text-white',
  n1: 'bg-purple-600 text-white',
  n2: 'bg-purple-800 text-purple-50',
  officier: 'bg-purple-950 text-purple-200 ring-1 ring-purple-700',
  membre: 'bg-zinc-800 text-zinc-200',
  pending: 'bg-amber-950 text-amber-200',
  revoque: 'bg-red-950 text-red-300',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${ROLE_STYLES[role] ?? ROLE_STYLES.membre}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

// Initiale du nom RP : aucune photo de compte n'est affichée
export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-900 text-sm font-semibold text-purple-100">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">{children}</p>
}

// Écran centré pour les pages hors layout (connexion, attente, chargement)
export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-l-4 border-zinc-800 border-l-purple-600 bg-zinc-900 p-8">
        {children}
      </div>
    </main>
  )
}

export function Logo({ className = 'size-20' }: { className?: string }) {
  return <img src={logo} alt="Ballas" className={`rounded-xl ${className}`} />
}

// Indicateur de chargement commun : plein écran au démarrage, compact dans une carte
export function Chargement({ pleinEcran = false }: { pleinEcran?: boolean }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 ${pleinEcran ? 'min-h-svh' : 'py-8'}`}
    >
      <img src={logoChargement} alt="" className={`animate-pulse ${pleinEcran ? 'size-28' : 'size-16'}`} />
      <p className="text-sm font-medium tracking-wide text-zinc-400">Chargement</p>
    </div>
  )
}

export const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none'
