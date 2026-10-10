import { doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Article } from '../../types'
import { quantiteDans } from './useArticles'

// Fait varier un item dans le stock d'un lieu, dans une écriture groupée. Jamais sous zéro ; un item reçu qui
// n'était pas encore suivi entre au Stock « Sans catégorie ».
export function varierStock(batch: WriteBatch, articles: Article[], reference: string, lieuId: string, delta: number) {
  const article = articles.find((a) => a.id === reference)
  if (article) {
    batch.update(doc(db, 'articles', reference), {
      [`quantites.${lieuId}`]: Math.max(0, quantiteDans(article, lieuId) + delta),
      updatedAt: serverTimestamp(),
    })
  } else if (delta > 0) {
    batch.set(doc(db, 'articles', reference), {
      categorieId: '',
      quantites: { [lieuId]: delta },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

// Quantité d'un item tous lieux confondus
export function quantiteTotale(articles: Article[], reference: string): number {
  const article = articles.find((a) => a.id === reference)
  return Object.values(article?.quantites ?? {}).reduce((somme, q) => somme + Math.max(0, q), 0)
}
