import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Article } from '../../types'

const requete = () => collection(db, 'articles')
const versArticle = (id: string, data: DocumentData) => ({ id, ...data, quantites: data.quantites ?? {} }) as Article

export function useArticles() {
  return useCollection(requete, versArticle)
}

// Quantité d'un article dans un lieu ; jamais négative à l'affichage
export function quantiteDans(article: Article, lieuId: string): number {
  return Math.max(0, article.quantites[lieuId] ?? 0)
}
