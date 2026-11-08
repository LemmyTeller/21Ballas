import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { REFERENCE_POCHON, pochonsPour } from '../../lib/biz'
import { REFERENCE_TETE } from '../../lib/carte'
import { db } from '../../lib/firebase'
import type { Article, Transformation } from '../../types'
import { varierStock } from '../stock/mouvements'

const SOURCE = 'Zone de transformation'

// ---- Zone de transformation : on y dépose des têtes, elles deviennent des pochons gardés pour les go-fast ----

export const refZone = () => doc(db, 'zoneTransformation', 'courante')

// Enregistre l'état de la zone à l'instant, à l'heure du serveur
function enregistrerZone(batch: ReturnType<typeof writeBatch>, etat: { tetes: number; pochons: number }) {
  batch.set(refZone(), {
    tetes: Math.max(0, etat.tetes),
    pochons: Math.max(0, etat.pochons),
    releveAt: serverTimestamp(),
  })
}

// Dépose des têtes dans la zone. `actuel` : son état exact à l'instant. Avec un lieu, les têtes en sortent.
export async function deposerTetes(
  actuel: { tetes: number; pochons: number },
  tetes: number,
  lieuId: string | null,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  enregistrerZone(batch, { tetes: actuel.tetes + tetes, pochons: actuel.pochons })
  if (lieuId) varierStock(batch, articles, REFERENCE_TETE, lieuId, -tetes, SOURCE)
  await batch.commit()
}

// Range des pochons dans la zone, qui sert aussi de stockage. Avec un lieu, ils en sortent.
export async function deposerPochons(
  actuel: { tetes: number; pochons: number },
  pochons: number,
  lieuId: string | null,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  enregistrerZone(batch, { tetes: actuel.tetes, pochons: actuel.pochons + pochons })
  if (lieuId) varierStock(batch, articles, REFERENCE_POCHON, lieuId, -pochons, SOURCE)
  await batch.commit()
}

// Retire des pochons de la zone, pour un go-fast. Avec un lieu, ils y entrent en stock.
export async function retirerPochons(
  actuel: { tetes: number; pochons: number },
  pochons: number,
  lieuId: string | null,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  enregistrerZone(batch, { tetes: actuel.tetes, pochons: actuel.pochons - pochons })
  if (lieuId) varierStock(batch, articles, REFERENCE_POCHON, lieuId, pochons, SOURCE)
  await batch.commit()
}

// Recale la zone sur les chiffres lus en jeu
export async function releverZone(releve: { tetes: number; pochons: number }): Promise<void> {
  const batch = writeBatch(db)
  enregistrerZone(batch, releve)
  await batch.commit()
}

// ---- Anciens lots à l'établi (un seul, récupéré à la fin) : plus aucun n'est lancé ----

// Récupération d'un ancien lot terminé : ses pochons entrent dans le stock du lieu choisi
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
  if (lieuPochonsId) varierStock(batch, articles, REFERENCE_POCHON, lieuPochonsId, pochons, SOURCE)
  await batch.commit()
}

// Annulation d'un ancien lot en cours : il disparaît et ses têtes retournent d'où elles venaient
export async function annulerLot(lot: Transformation, articles: Article[]): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'transformations', lot.id))
  if (lot.lieuId) varierStock(batch, articles, REFERENCE_TETE, lot.lieuId, lot.tetes, SOURCE)
  await batch.commit()
}
