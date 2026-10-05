import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { jourDeSaisie } from '../../lib/journee'
import type { Article, Carjacking } from '../../types'
import { REFERENCE_ARGENT_SALE } from '../commerce/api'

// Nouvelle voiture à aller voler ; `spawn` est null pour un modèle hors catalogue
export async function ajouterCarjacking(
  modele: { modele: string; spawn: string | null },
  note: string,
  // Groupe demandeur, ou null si la voiture n'est pour aucun groupe
  partenaireId: string | null,
  creeParUid: string,
): Promise<void> {
  await addDoc(collection(db, 'carjackings'), {
    spawn: modele.spawn,
    modele: modele.modele.trim(),
    note: note.trim(),
    partenaireId,
    statut: 'a_voler',
    creeParUid,
    createdAt: serverTimestamp(),
  })
}

export async function marquerVole(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'carjackings', id), { statut: 'vole', voleParUid: uid, voleAt: serverTimestamp() })
}

export async function marquerDepose(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'carjackings', id), { statut: 'depose', deposeParUid: uid, deposeAt: serverTimestamp() })
}

// Retour à l'étape précédente, pour corriger une erreur
export async function revenirEnArriere(carjacking: Carjacking): Promise<void> {
  const ref = doc(db, 'carjackings', carjacking.id)
  if (carjacking.statut === 'vole') {
    await updateDoc(ref, { statut: 'a_voler', voleParUid: deleteField(), voleAt: deleteField() })
  } else if (carjacking.statut === 'depose') {
    await updateDoc(ref, { statut: 'vole', deposeParUid: deleteField(), deposeAt: deleteField() })
  }
}

export async function supprimerCarjacking(id: string): Promise<void> {
  await deleteDoc(doc(db, 'carjackings', id))
}

export interface Rachat {
  rachete: boolean
  // Montant en sale ; null si la voiture n'a pas été rachetée
  montant: number | null
  // Lieu où entrent les billets de 1$ ; null pour ne pas toucher au stock
  lieuId: string | null
}

// Clôt la fiche. Si la voiture est rachetée, les billets de 1$ entrent dans le stock du lieu et dans la saisie
// journalière, dans la même écriture.
export async function cloturerCarjacking(
  id: string,
  rachat: Rachat,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'carjackings', id), {
    statut: 'clos',
    ...rachat,
    closParUid: acteurUid,
    closAt: serverTimestamp(),
  })

  const billets = Math.round(rachat.montant ?? 0)
  if (rachat.rachete && rachat.lieuId && billets > 0) {
    const ref = doc(db, 'articles', REFERENCE_ARGENT_SALE)
    if (articles.some((a) => a.id === REFERENCE_ARGENT_SALE)) {
      batch.update(ref, { [`quantites.${rachat.lieuId}`]: increment(billets), updatedAt: serverTimestamp() })
    } else {
      // Les billets n'étaient pas encore suivis : ils entrent au Stock, à classer ensuite (« Sans catégorie »)
      batch.set(ref, {
        categorieId: '',
        quantites: { [rachat.lieuId]: billets },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  // Le sale du rachat est une entrée du jour : il s'inscrit dans la saisie journalière, même sans toucher au stock
  if (rachat.rachete && billets > 0) {
    batch.set(
      doc(db, 'saisies', jourDeSaisie(Date.now())),
      { quantites: { [REFERENCE_ARGENT_SALE]: increment(billets) }, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }

  await batch.commit()
}
