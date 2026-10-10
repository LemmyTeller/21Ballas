import { Link } from 'react-router-dom'
import { ImageItem } from '../../components/ImageItem'
import { Card, Chargement, ErrorMessage } from '../../components/ui'
import { formatNombre, formatPrix } from '../../lib/format'
import { useReferences } from '../../lib/useCatalogue'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'
import { useArticles } from '../stock/useArticles'

// Items du catalogue suivis par la tuile, dans l'ordre de la filière : graine, tête, pochon
const WEED = [
  { cle: '610', nom: 'Graines de weed' },
  { cle: '167', nom: 'Têtes de weed' },
  { cle: '169', nom: 'Pochons de weed' },
]

// Résumé du business pour l'accueil : l'argent sale et la weed en stock, tous coffres confondus.
// Le détail par lieu est dans l'onglet Stock.
export function Biz() {
  const articles = useArticles()
  const catalogue = useReferences()

  const total = (cle: string) =>
    Object.values(articles.data.find((a) => a.id === cle)?.quantites ?? {}).reduce((somme, q) => somme + Math.max(0, q), 0)
  const reference = (cle: string) => catalogue.items?.find((r) => r.cle === cle)

  return (
    <Card
      className="p-4!"
      title="Biz"
      action={
        <Link to="/bizness" className="text-xs text-zinc-500 hover:text-purple-300">
          Voir le biz
        </Link>
      }
    >
      <ErrorMessage>{articles.error ?? catalogue.erreur}</ErrorMessage>
      {articles.loading ? (
        <Chargement />
      ) : (
        <>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Argent sale dans les coffres</p>
          <p className="mt-0.5 mb-2 text-2xl font-semibold text-amber-400 tabular-nums">
            {formatPrix(total(REFERENCE_ARGENT_SALE))}
          </p>
          <ul className="divide-y divide-zinc-800">
            {WEED.map((item) => (
              <li key={item.cle} className="flex items-center gap-3 py-1.5 text-sm">
                <ImageItem item={reference(item.cle)} />
                <span className="min-w-0 flex-1 truncate text-zinc-300">{item.nom}</span>
                <span className="font-semibold text-zinc-100 tabular-nums">{formatNombre(total(item.cle))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
