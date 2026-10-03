import { doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Article } from '../../types'

// Ajoute du butin : la quantité s'ajoute à la saisie du jour et au stock du lieu, dans la même écriture.
// `article` : l'article du Stock s'il existe déjà ; sinon l'item y entre « Sans catégorie », à classer ensuite.
// Une quantité négative corrige une erreur de saisie.
export async function ajouterSaisie(
  jour: string,
  reference: string,
  quantite: number,
  lieuId: string,
  article: Article | undefined,
): Promise<void> {
  const batch = writeBatch(db)

  batch.set(
    doc(db, 'saisies', jour),
    { quantites: { [reference]: increment(quantite) }, updatedAt: serverTimestamp() },
    { merge: true },
  )

  if (article) {
    batch.update(doc(db, 'articles', reference), {
      [`quantites.${lieuId}`]: increment(quantite),
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.set(doc(db, 'articles', reference), {
      categorieId: '',
      quantites: { [lieuId]: quantite },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}
