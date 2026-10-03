import { useState } from 'react'

// Photos de la documentation de FiveM, rangées par nom de spawn
const IMAGES_URL = 'https://docs.fivem.net/vehicles/'

// Photo d'un véhicule du catalogue ; cadre vide si le modèle est inconnu ou si l'image est introuvable.
// `className` fixe la taille (les photos sont au format paysage).
export function ImageVehicule({ spawn, className = 'h-10 w-16' }: { spawn: string | null | undefined; className?: string }) {
  const [introuvable, setIntrouvable] = useState<string | null>(null)

  if (!spawn || introuvable === spawn) {
    return <span className={`block shrink-0 rounded-md border border-dashed border-zinc-700 ${className}`} title="Pas de photo" />
  }
  return (
    <img
      src={`${IMAGES_URL}${encodeURIComponent(spawn)}.webp`}
      alt=""
      loading="lazy"
      // Véhicule entier, jamais rogné : les photos n'ont pas toutes les mêmes proportions
      className={`shrink-0 rounded-md object-contain ${className}`}
      onError={() => setIntrouvable(spawn)}
    />
  )
}
