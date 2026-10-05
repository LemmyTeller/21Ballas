import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { jourDeSaisie } from '../../lib/journee'
import type { Article, Commande, Echange, LigneCommande, Partenaire, SensTarif } from '../../types'
import { quantiteDans } from '../stock/useArticles'

// Item « Billet de 1$ » du catalogue : c'est lui qui représente l'argent sale dans le Stock
export const REFERENCE_ARGENT_SALE = '71'

export async function creerCommande(partenaire: Partenaire, ligne: LigneCommande, creeParUid: string): Promise<void> {
  await addDoc(collection(db, 'commandes'), {
    partenaireId: partenaire.id,
    partenaireNom: partenaire.nom,
    sens: ligne.sens,
    statut: 'en_attente',
    lignes: [ligne],
    creeParUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const memeLigne = (a: LigneCommande, b: LigneCommande) => a.reference === b.reference && a.sens === b.sens

// Un item déjà présent dans le même sens voit sa quantité augmenter et reprend le prix courant
export function fusionnerLigne(lignes: LigneCommande[], ligne: LigneCommande): LigneCommande[] {
  const existante = lignes.find((l) => memeLigne(l, ligne))
  if (!existante) return [...lignes, ligne]
  return lignes.map((l) => (l === existante ? { ...ligne, quantite: l.quantite + ligne.quantite } : l))
}

export async function majLignes(commandeId: string, lignes: LigneCommande[]): Promise<void> {
  await updateDoc(doc(db, 'commandes', commandeId), { lignes, updatedAt: serverTimestamp() })
}

export const lignesDe = (commande: Pick<Commande, 'lignes'>, sens: SensTarif) =>
  commande.lignes.filter((l) => l.sens === sens)

// « Vente à », « Achat à » ou, si la commande mêle les deux, « Vente et achat avec »
export function titreCommande(commande: Pick<Commande, 'lignes' | 'partenaireNom'>): string {
  const vente = lignesDe(commande, 'vente').length > 0
  const achat = lignesDe(commande, 'achat').length > 0
  const prefixe = vente && achat ? 'Vente et achat avec' : achat ? 'Achat à' : 'Vente à'
  return `${prefixe} ${commande.partenaireNom}`
}

// Règlement réel : ce que le groupe a reçu du partenaire et ce qu'il lui a donné
export interface Cloture {
  recuPropre: number | null
  recuSale: number | null
  recuItems: Echange[]
  payePropre: number | null
  payeSale: number | null
  payeItems: Echange[]
  lieuId: string | null
  note: string
}

const CLOTURE_VIDE: Cloture = {
  recuPropre: null,
  recuSale: null,
  recuItems: [],
  payePropre: null,
  payeSale: null,
  payeItems: [],
  lieuId: null,
  note: '',
}

// Variation de stock par item, dans le lieu choisi.
// Sortent : les items vendus, les items donnés, l'argent sale payé (billets de 1$).
// Entrent : les items achetés, les items repris, l'argent sale reçu.
export function variationsStock(commande: Commande, cloture: Cloture): Map<string, number> {
  const variations = new Map<string, number>()
  const ajouter = (reference: string, delta: number) =>
    variations.set(reference, (variations.get(reference) ?? 0) + delta)

  for (const ligne of commande.lignes) ajouter(ligne.reference, ligne.sens === 'vente' ? -ligne.quantite : ligne.quantite)
  for (const item of cloture.recuItems) ajouter(item.reference, item.quantite)
  for (const item of cloture.payeItems) ajouter(item.reference, -item.quantite)
  ajouter(REFERENCE_ARGENT_SALE, Math.round(cloture.recuSale ?? 0) - Math.round(cloture.payeSale ?? 0))

  for (const [reference, delta] of variations) if (delta === 0) variations.delete(reference)
  return variations
}

// Ce que la transaction fait entrer, par item : les items achetés, les items repris en échange et l'argent sale
// reçu (billets de 1$). Ce sont des entrées brutes : ce qui sort en face n'est pas déduit.
export function entreesSaisie(commande: Commande, cloture: Cloture): Map<string, number> {
  const entrees = new Map<string, number>()
  const ajouter = (reference: string, quantite: number) => {
    if (quantite > 0) entrees.set(reference, (entrees.get(reference) ?? 0) + quantite)
  }

  for (const ligne of lignesDe(commande, 'achat')) ajouter(ligne.reference, ligne.quantite)
  for (const item of cloture.recuItems) ajouter(item.reference, item.quantite)
  ajouter(REFERENCE_ARGENT_SALE, Math.round(cloture.recuSale ?? 0))
  return entrees
}

// Validation : la commande est close, le stock du lieu mis à jour et les entrées ajoutées à la saisie du jour,
// dans la même écriture. Sans lieu, le stock n'est pas touché.
export async function validerCommande(
  commande: Commande,
  cloture: Cloture,
  acteurUid: string,
  articles: Article[],
): Promise<void> {
  const batch = writeBatch(db)

  if (cloture.lieuId) {
    for (const [reference, delta] of variationsStock(commande, cloture)) {
      const article = articles.find((a) => a.id === reference)
      if (article) {
        // Jamais sous zéro : on ne peut pas sortir plus que ce que le lieu contient
        const quantite = Math.max(0, quantiteDans(article, cloture.lieuId) + delta)
        batch.update(doc(db, 'articles', reference), {
          [`quantites.${cloture.lieuId}`]: quantite,
          updatedAt: serverTimestamp(),
        })
      } else if (delta > 0) {
        // Item reçu qui n'était pas encore suivi : il entre au Stock, à classer ensuite (« Sans catégorie »)
        batch.set(doc(db, 'articles', reference), {
          categorieId: '',
          quantites: { [cloture.lieuId]: delta },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    }
  }

  // La saisie journalière est le journal des entrées, jour par jour : la transaction s'y inscrit toute seule
  const entrees = entreesSaisie(commande, cloture)
  if (entrees.size > 0) {
    const quantites: Record<string, FieldValue> = {}
    for (const [reference, quantite] of entrees) quantites[reference] = increment(quantite)
    batch.set(
      doc(db, 'saisies', jourDeSaisie(Date.now())),
      { quantites, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }

  batch.update(doc(db, 'commandes', commande.id), {
    statut: 'validee',
    ...cloture,
    note: cloture.note.trim(),
    clotureParUid: acteurUid,
    clotureAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

// Annulation : la commande passe dans l'historique, sans aucun effet sur le stock
export async function annulerCommande(commandeId: string, acteurUid: string): Promise<void> {
  await updateDoc(doc(db, 'commandes', commandeId), {
    statut: 'annulee',
    ...CLOTURE_VIDE,
    clotureParUid: acteurUid,
    clotureAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Montant attendu de lignes dans une monnaie ; null si aucune n'a de prix dans cette monnaie
export function montantAttendu(lignes: LigneCommande[], monnaie: 'prixPropre' | 'prixSale'): number | null {
  const chiffrees = lignes.filter((l) => l[monnaie] !== null)
  return chiffrees.length === 0 ? null : chiffrees.reduce((total, l) => total + l.quantite * (l[monnaie] ?? 0), 0)
}
