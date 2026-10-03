import { useState } from 'react'
import type { Item } from '../types'

const IMAGES_URL = 'https://s3.21jumpclick.fr/21depot/fivem/'

// Image d'un item ou d'une arme du catalogue ; cadre vide si elle manque ou est introuvable
export function ImageItem({
  item,
  dossier = 'items',
}: {
  item: Pick<Item, 'image'> | undefined
  dossier?: 'items' | 'weapons'
}) {
  const [introuvable, setIntrouvable] = useState(false)

  if (!item?.image || introuvable) {
    return <span className="block size-10 shrink-0 rounded-md border border-dashed border-zinc-700" title="Pas d’image" />
  }
  return (
    <img
      src={`${IMAGES_URL}${dossier}/${encodeURIComponent(item.image)}`}
      alt=""
      loading="lazy"
      className="size-10 shrink-0 object-contain"
      onError={() => setIntrouvable(true)}
    />
  )
}
