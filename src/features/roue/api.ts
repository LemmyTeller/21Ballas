import { addDoc, collection, serverTimestamp, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { CASES_ROUE, appliquerCase } from '../../lib/roue'
import { useCollection } from '../../lib/useCollection'
import type { TirageRoue } from '../../types'

// Enregistre un tour de roue avant même que la roue ait fini de tourner : le résultat est acquis dès le tirage
export async function enregistrerTirage(
  quantite: number,
  partenaire: { id: string; nom: string } | null,
  caseIndex: number,
  parUid: string,
): Promise<void> {
  const caseRoue = CASES_ROUE[caseIndex]
  await addDoc(collection(db, 'tiragesRoue'), {
    quantite,
    partenaireId: partenaire?.id ?? null,
    partenaireNom: partenaire?.nom ?? '',
    caseIndex,
    libelle: caseRoue.libelle,
    resultat: appliquerCase(quantite, caseRoue),
    parUid,
    createdAt: serverTimestamp(),
  })
}

const requete = () => collection(db, 'tiragesRoue')
const versTirage = (id: string, data: DocumentData) => ({ id, ...data }) as TirageRoue

// Tous les tours de roue
export function useTirages() {
  return useCollection(requete, versTirage)
}
