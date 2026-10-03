import type { Partenaire } from '../../types'
import { COULEUR_DEFAUT } from './api'

// Tuile à la couleur de l'organisation, pour la repérer d'un coup d'œil
export function TuileCouleur({ partenaire, className = 'size-4' }: { partenaire: Pick<Partenaire, 'couleur'>; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-sm ring-1 ring-black/40 ${className}`}
      style={{ backgroundColor: partenaire.couleur ?? COULEUR_DEFAUT }}
    />
  )
}
