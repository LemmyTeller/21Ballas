import { collection, doc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { REFERENCE_POCHON } from '../../lib/biz'
import { REFERENCE_GRAINE, REFERENCE_TETE } from '../../lib/carte'
import { auth, db } from '../../lib/firebase'
import type { Article } from '../../types'
import { quantiteDans } from './useArticles'

// Items dont chaque entrée et sortie de stock est notée, pour le graphique de l'onglet Bizne$$
export const REFERENCES_SUIVIES = [REFERENCE_GRAINE, REFERENCE_TETE, REFERENCE_POCHON]

// Note un mouvement de stock dans `mouvementsStock`, dans la même écriture groupée que le mouvement lui-même.
// Sans effet pour un item non suivi ou une variation nulle. `source` : d'où vient le mouvement (« Saisie journalière »…).
export function noterMouvement(
  batch: WriteBatch,
  reference: string,
  delta: number,
  lieuId: string | null,
  source: string,
) {
  const uid = auth.currentUser?.uid
  if (!uid || !REFERENCES_SUIVIES.includes(reference) || !Number.isFinite(delta) || Math.round(delta) === 0) return
  batch.set(doc(collection(db, 'mouvementsStock')), {
    reference,
    delta: Math.round(delta),
    lieuId,
    source,
    parUid: uid,
    createdAt: serverTimestamp(),
  })
}

// Fait varier un item dans le stock d'un lieu, dans une écriture groupée, et note le mouvement. Jamais sous zéro ;
// un item reçu qui n'était pas encore suivi entre au Stock « Sans catégorie ».
export function varierStock(
  batch: WriteBatch,
  articles: Article[],
  reference: string,
  lieuId: string,
  delta: number,
  source: string,
) {
  const article = articles.find((a) => a.id === reference)
  if (article) {
    const avant = quantiteDans(article, lieuId)
    const apres = Math.max(0, avant + delta)
    batch.update(doc(db, 'articles', reference), {
      [`quantites.${lieuId}`]: apres,
      updatedAt: serverTimestamp(),
    })
    noterMouvement(batch, reference, apres - avant, lieuId, source)
  } else if (delta > 0) {
    batch.set(doc(db, 'articles', reference), {
      categorieId: '',
      quantites: { [lieuId]: delta },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    noterMouvement(batch, reference, delta, lieuId, source)
  }
}

// Quantité d'un item tous lieux confondus
export function quantiteTotale(articles: Article[], reference: string): number {
  const article = articles.find((a) => a.id === reference)
  return Object.values(article?.quantites ?? {}).reduce((somme, q) => somme + Math.max(0, q), 0)
}
