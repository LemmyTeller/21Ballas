import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Article, Commande, Echange, LigneCommande, Partenaire, SensTarif } from '../../types'
import { quantiteDans } from '../stock/useArticles'

// Item « Billet de 1$ » du catalogue : c'est lui qui représente l'argent sale dans le Stock
export const REFERENCE_ARGENT_SALE = '71'

export async function creerCommande(
  partenaire: Partenaire,
  sens: SensTarif,
  ligne: LigneCommande,
  creeParUid: string,
): Promise<void> {
  await addDoc(collection(db, 'commandes'), {
    partenaireId: partenaire.id,
    partenaireNom: partenaire.nom,
    sens,
    statut: 'en_attente',
    lignes: [ligne],
    creeParUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Un item déjà présent dans la commande voit sa quantité augmenter et reprend le prix courant
export function fusionnerLigne(lignes: LigneCommande[], ligne: LigneCommande): LigneCommande[] {
  const existante = lignes.find((l) => l.reference === ligne.reference)
  if (!existante) return [...lignes, ligne]
  return lignes.map((l) => (l === existante ? { ...ligne, quantite: l.quantite + ligne.quantite } : l))
}

export async function majLignes(commandeId: string, lignes: LigneCommande[]): Promise<void> {
  await updateDoc(doc(db, 'commandes', commandeId), { lignes, updatedAt: serverTimestamp() })
}

export interface Cloture {
  montantPropre: number | null
  montantSale: number | null
  echanges: Echange[]
  lieuId: string | null
  note: string
}

// Variation de stock par item, dans le lieu choisi.
// Vente : les items vendus sortent ; les items repris et l'argent sale (billets de 1$) entrent. Achat : l'inverse.
export function variationsStock(commande: Commande, cloture: Cloture): Map<string, number> {
  const sortie = commande.sens === 'vente' ? -1 : 1
  const variations = new Map<string, number>()
  const ajouter = (reference: string, delta: number) =>
    variations.set(reference, (variations.get(reference) ?? 0) + delta)

  for (const ligne of commande.lignes) ajouter(ligne.reference, sortie * ligne.quantite)
  for (const echange of cloture.echanges) ajouter(echange.reference, -sortie * echange.quantite)
  if (cloture.montantSale) ajouter(REFERENCE_ARGENT_SALE, -sortie * Math.round(cloture.montantSale))

  for (const [reference, delta] of variations) if (delta === 0) variations.delete(reference)
  return variations
}

// Validation : la commande est close et le stock du lieu mis à jour, dans la même écriture.
// Sans lieu, seule la commande est close.
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
    montantPropre: null,
    montantSale: null,
    echanges: [],
    lieuId: null,
    note: '',
    clotureParUid: acteurUid,
    clotureAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// Montant attendu d'une commande dans une monnaie ; null si aucune ligne n'a de prix dans cette monnaie
export function montantAttendu(lignes: LigneCommande[], monnaie: 'prixPropre' | 'prixSale'): number | null {
  const chiffrees = lignes.filter((l) => l[monnaie] !== null)
  return chiffrees.length === 0 ? null : chiffrees.reduce((total, l) => total + l.quantite * (l[monnaie] ?? 0), 0)
}
