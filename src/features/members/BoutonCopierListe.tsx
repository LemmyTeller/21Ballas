import { useState } from 'react'
import { Button } from '../../components/ui'
import type { Membre } from '../../types'
import { listeMembresTexte } from './listeTexte'

// Copie l'effectif dans le presse-papiers (voir listeMembresTexte). `icone` : bouton compact, sans texte.
export function BoutonCopierListe({ membres, icone = false }: { membres: Membre[]; icone?: boolean }) {
  const [copie, setCopie] = useState<'ok' | 'erreur' | null>(null)

  async function copier() {
    try {
      await navigator.clipboard.writeText(listeMembresTexte(membres))
      setCopie('ok')
    } catch {
      setCopie('erreur')
    }
    setTimeout(() => setCopie(null), 2500)
  }

  const etat = copie === 'ok' ? 'Liste copiée' : copie === 'erreur' ? 'Copie impossible' : 'Copier la liste des membres'

  if (!icone) {
    return (
      <Button variant="ghost" disabled={membres.length === 0} onClick={copier}>
        {copie === 'ok' ? 'Liste copiée' : copie === 'erreur' ? 'Copie impossible' : 'Copier la liste'}
      </Button>
    )
  }

  return (
    <button
      type="button"
      aria-label={etat}
      title={etat}
      disabled={membres.length === 0}
      className={`flex size-8 items-center justify-center rounded-md border border-zinc-700 transition-colors hover:bg-zinc-800 disabled:opacity-40 ${
        copie === 'ok' ? 'text-emerald-400' : copie === 'erreur' ? 'text-red-400' : 'text-zinc-300'
      }`}
      onClick={copier}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {copie === 'ok' ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  )
}
