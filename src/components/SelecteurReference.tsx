import { useState } from 'react'
import type { Reference } from '../types'
import { ImageItem } from './ImageItem'
import { Button, inputClass } from './ui'

const RESULTATS_MAX = 8

// Choix d'un item ou d'une arme du catalogue : recherche par nom, puis rappel de la sélection avec « Changer »
export function SelecteurReference({
  catalogue,
  selection,
  onSelection,
}: {
  catalogue: Reference[]
  selection: Reference | null
  onSelection: (reference: Reference | null) => void
}) {
  const [recherche, setRecherche] = useState('')

  if (selection) {
    return (
      <div className="flex items-center gap-3">
        <ImageItem item={selection} dossier={selection.dossier} />
        <span className="flex-1 font-medium text-zinc-100">{selection.name}</span>
        <Button variant="ghost" onClick={() => onSelection(null)}>
          Changer
        </Button>
      </div>
    )
  }

  const terme = recherche.trim().toLocaleLowerCase('fr')
  const resultats = terme
    ? catalogue.filter((r) => r.name.toLocaleLowerCase('fr').includes(terme)).slice(0, RESULTATS_MAX)
    : []

  return (
    <>
      <input
        type="search"
        className={inputClass}
        placeholder="Rechercher un item ou une arme"
        value={recherche}
        autoFocus
        onChange={(e) => setRecherche(e.target.value)}
      />
      <ul className="divide-y divide-zinc-800">
        {resultats.map((r) => (
          <li key={r.cle}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left text-sm text-zinc-100 hover:bg-zinc-800"
              onClick={() => onSelection(r)}
            >
              <ImageItem item={r} dossier={r.dossier} />
              <span className="flex-1">{r.name}</span>
              {r.dossier === 'weapons' && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">Arme</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {terme && resultats.length === 0 && <p className="text-sm text-zinc-500">Aucun item ne correspond.</p>}
    </>
  )
}
