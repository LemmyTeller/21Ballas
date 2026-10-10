import {
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { REFERENCE_GRAINE, REFERENCE_TETE, TETES_PAR_PLANT, etapeSuivante } from '../../lib/carte'
import { db } from '../../lib/firebase'
import { jourDeSaisie } from '../../lib/journee'
import type { Article, PointCarte, TypePoint } from '../../types'
import { varierStock } from '../stock/mouvements'

// Ce que la fenêtre de saisie renseigne ; les champs qui ne concernent pas le type sont ignorés
export interface PointSaisie {
  nom: string
  commentaire: string
  proprietaireId: string | null
  // Commerce du Blanchiment auquel le point est rattaché, ou null
  commerceId: string | null
  quantite: number | null
}

// Seuls les champs du type sont gardés : appartenance pour un commerce, quantité pour un plan
const champs = (type: TypePoint, saisie: PointSaisie) => ({
  nom: type === 'plan' ? '' : saisie.nom.trim(),
  commentaire: saisie.commentaire.trim(),
  proprietaireId: type === 'commerce' ? saisie.proprietaireId : null,
  commerceId: type === 'commerce' ? saisie.commerceId : null,
  quantite: type === 'plan' ? saisie.quantite : null,
})

// Un plan de récolte naît en germination, à l'heure du serveur. Avec `stock`, ses graines (une par plant)
// sortent du lieu choisi dans la même écriture.
export async function creerPoint(
  type: TypePoint,
  position: { x: number; y: number },
  saisie: PointSaisie,
  creeParUid: string,
  stock?: { lieuId: string; articles: Article[] },
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'pointsCarte')), {
    type,
    ...position,
    ...champs(type, saisie),
    etape: type === 'plan' ? 'germination' : null,
    etapeDebut: type === 'plan' ? serverTimestamp() : null,
    creeParUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (type === 'plan' && stock && saisie.quantite) {
    varierStock(batch, stock.articles, REFERENCE_GRAINE, stock.lieuId, -saisie.quantite)
  }
  await batch.commit()
}

export async function modifierPoint(point: PointCarte, saisie: PointSaisie): Promise<void> {
  await updateDoc(doc(db, 'pointsCarte', point.id), { ...champs(point.type, saisie), updatedAt: serverTimestamp() })
}

export async function deplacerPoint(id: string, position: { x: number; y: number }): Promise<void> {
  await updateDoc(doc(db, 'pointsCarte', id), { ...position, updatedAt: serverTimestamp() })
}

// Arrosage : le plan passe à l'étape suivante, dont les 30 minutes partent maintenant
export async function arroserPlan(point: PointCarte): Promise<void> {
  const etape = etapeSuivante(point.etape)
  if (!etape) return
  await updateDoc(doc(db, 'pointsCarte', point.id), {
    etape,
    etapeDebut: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Récolte : le plan disparaît de la carte et ses têtes (dix par plant) entrent dans la saisie journalière,
// ainsi que dans le stock du lieu choisi (`lieuId` null : stock non touché), dans la même écriture.
export async function recolterPlan(
  point: PointCarte,
  lieuId: string | null,
  articles: Article[],
  parUid: string,
): Promise<void> {
  const plants = point.quantite ?? 0
  const tetes = plants * TETES_PAR_PLANT
  const batch = writeBatch(db)
  batch.delete(doc(db, 'pointsCarte', point.id))
  if (tetes > 0) {
    // Le plan disparaît : la récolte est notée à part, pour le bilan de l'onglet Bizne$$
    batch.set(doc(collection(db, 'recoltes')), { plants, tetes, parUid, createdAt: serverTimestamp() })
    if (lieuId) varierStock(batch, articles, REFERENCE_TETE, lieuId, tetes)
    batch.set(
      doc(db, 'saisies', jourDeSaisie(Date.now())),
      { quantites: { [REFERENCE_TETE]: increment(tetes) }, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }
  await batch.commit()
}

// Suppression d'un point, sans effet sur le stock
export async function supprimerPoint(id: string): Promise<void> {
  await deleteDoc(doc(db, 'pointsCarte', id))
}
