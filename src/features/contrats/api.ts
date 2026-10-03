import { Timestamp, addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Contrat } from '../../types'

export type ContratSaisie = Pick<Contrat, 'libelle' | 'montant' | 'echeance' | 'heureFixee' | 'hebdo' | 'note'>

function nettoyer(saisie: ContratSaisie): ContratSaisie {
  return { ...saisie, libelle: saisie.libelle.trim(), note: saisie.note.trim() }
}

export async function creerContrat(saisie: ContratSaisie): Promise<void> {
  await addDoc(collection(db, 'contrats'), { ...nettoyer(saisie), paye: false, createdAt: serverTimestamp() })
}

// Changer l'échéance remet le contrat à payer : l'ancien « payé » portait sur l'ancienne échéance
export async function majContrat(contrat: Contrat, saisie: ContratSaisie): Promise<void> {
  const echeanceChangee = saisie.echeance.toMillis() !== contrat.echeance.toMillis()
  await updateDoc(doc(db, 'contrats', contrat.id), { ...nettoyer(saisie), ...(echeanceChangee ? { paye: false } : {}) })
}

export async function supprimerContrat(id: string): Promise<void> {
  await deleteDoc(doc(db, 'contrats', id))
}

const UNE_SEMAINE = 7 * 24 * 3_600_000
const UN_JOUR = 24 * 3_600_000

// Échéance à regarder en ce moment, et si elle est payée.
// Contrat ponctuel : la sienne. Contrat hebdomadaire : une fois l'échéance payée et passée,
// c'est celle de la semaine suivante qui devient due, non payée.
export function echeanceCourante(contrat: Contrat, maintenant: number): { echeance: number; paye: boolean } {
  const echeance = contrat.echeance.toMillis()
  if (contrat.hebdo && contrat.paye && maintenant > echeance) return { echeance: echeance + UNE_SEMAINE, paye: false }
  return { echeance, paye: contrat.paye }
}

// Marque payée (ou non) l'échéance en cours ; pour un contrat hebdomadaire, c'est elle qu'on enregistre
export async function marquerPaye(contrat: Contrat, maintenant: number, paye: boolean): Promise<void> {
  const { echeance } = echeanceCourante(contrat, maintenant)
  await updateDoc(doc(db, 'contrats', contrat.id), { paye, echeance: Timestamp.fromMillis(echeance) })
}

export type EtatContrat = 'paye' | 'retard' | 'proche' | 'a_venir'

// Payé ; sinon en retard une fois l'échéance passée, proche dans les 24 h qui la précèdent
export function etatContrat(contrat: Contrat, maintenant: number): EtatContrat {
  const { echeance, paye } = echeanceCourante(contrat, maintenant)
  if (paye) return 'paye'
  const reste = echeance - maintenant
  if (reste < 0) return 'retard'
  return reste <= UN_JOUR ? 'proche' : 'a_venir'
}
