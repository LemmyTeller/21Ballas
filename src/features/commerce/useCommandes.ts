import { collection, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useCollection } from '../../lib/useCollection'
import type { Commande, LigneCommande } from '../../types'

const requete = () => collection(db, 'commandes')

// Les premières commandes n'avaient qu'un sens global et un seul règlement (montantPropre, montantSale, echanges) :
// on les ramène au format actuel, où chaque ligne porte son sens et où le reçu et le payé sont séparés.
function versCommande(id: string, data: DocumentData): Commande {
  const lignes = ((data.lignes ?? []) as LigneCommande[]).map((l) => ({ ...l, sens: l.sens ?? data.sens }))
  const ancienReglement =
    data.statut === 'validee' && data.recuItems === undefined
      ? data.sens === 'vente'
        ? { recuPropre: data.montantPropre, recuSale: data.montantSale, recuItems: data.echanges ?? [] }
        : { payePropre: data.montantPropre, payeSale: data.montantSale, payeItems: data.echanges ?? [] }
      : {}
  return { id, ...data, ...ancienReglement, lignes } as Commande
}

export function useCommandes() {
  return useCollection(requete, versCommande)
}
