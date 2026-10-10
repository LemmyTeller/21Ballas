import { addDoc, collection, deleteDoc, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { GRAINES_PAR_CAISSE, REFERENCE_POCHON, SECONDES_PAR_TETE, pochonsPour } from '../../lib/biz'
import { REFERENCE_GRAINE, REFERENCE_TETE } from '../../lib/carte'
import { db } from '../../lib/firebase'
import { jourDeSaisie } from '../../lib/journee'
import type { Article, Caisse, Transformation } from '../../types'
import { varierStock } from '../stock/mouvements'

// ---- Caisses ----

export async function commanderCaisses(quantite: number, creeParUid: string): Promise<void> {
  await addDoc(collection(db, 'caisses'), {
    quantite,
    statut: 'commandee',
    creeParUid,
    createdAt: serverTimestamp(),
  })
}

// Clôture d'une commande : `recuperees` caisses sont arrivées, les autres sont perdues. Les graines des caisses
// récupérées entrent dans la saisie journalière et, si un lieu est choisi, dans son stock, dans la même écriture.
export async function cloreCaisses(
  caisse: Caisse,
  recuperees: number,
  lieuId: string | null,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const graines = recuperees * GRAINES_PAR_CAISSE
  const batch = writeBatch(db)
  batch.update(doc(db, 'caisses', caisse.id), {
    statut: 'close',
    recuperees,
    lieuId,
    closParUid: acteurUid,
    closAt: serverTimestamp(),
  })
  if (graines > 0) {
    if (lieuId) varierStock(batch, articles, REFERENCE_GRAINE, lieuId, graines)
    batch.set(
      doc(db, 'saisies', jourDeSaisie(Date.now())),
      { quantites: { [REFERENCE_GRAINE]: increment(graines) }, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }
  await batch.commit()
}

// Commande passée par erreur : possible tant qu'elle est en attente
export async function supprimerCaisses(id: string): Promise<void> {
  await deleteDoc(doc(db, 'caisses', id))
}

// ---- Établi ----

// Pose un lot de têtes sur l'établi. Avec un lieu, elles sortent de son stock dans la même écriture.
export async function lancerLot(
  tetes: number,
  lieuId: string | null,
  lanceParUid: string,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'transformations')), {
    tetes,
    dureeSecondes: tetes * SECONDES_PAR_TETE,
    debut: serverTimestamp(),
    statut: 'en_cours',
    lieuId,
    lanceParUid,
    createdAt: serverTimestamp(),
  })
  if (lieuId) varierStock(batch, articles, REFERENCE_TETE, lieuId, -tetes)
  await batch.commit()
}

// Récupération d'un lot terminé : ses pochons entrent dans le stock du lieu choisi
export async function recupererLot(
  lot: Transformation,
  lieuPochonsId: string | null,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const pochons = pochonsPour(lot.tetes)
  const batch = writeBatch(db)
  batch.update(doc(db, 'transformations', lot.id), {
    statut: 'recupere',
    pochons,
    lieuPochonsId,
    recupereParUid: acteurUid,
    recupereAt: serverTimestamp(),
  })
  if (lieuPochonsId) varierStock(batch, articles, REFERENCE_POCHON, lieuPochonsId, pochons)
  await batch.commit()
}

// Annulation d'un lot en cours : il disparaît et ses têtes retournent d'où elles venaient
export async function annulerLot(lot: Transformation, articles: Article[]): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'transformations', lot.id))
  if (lot.lieuId) varierStock(batch, articles, REFERENCE_TETE, lot.lieuId, lot.tetes)
  await batch.commit()
}
