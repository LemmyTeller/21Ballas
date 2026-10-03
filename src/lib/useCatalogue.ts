import { useEffect, useState } from 'react'
import type { Arme, Item, ModeleVehicule, Reference } from '../types'

// Catalogues chargés à la demande, une seule fois chacun : ils n'alourdissent pas le reste de l'appli
let items: Promise<Item[]> | null = null
let armes: Promise<Arme[]> | null = null
let references: Promise<Reference[]> | null = null
let modeles: Promise<ModeleVehicule[]> | null = null

const chargerItems = () => (items ??= import('../data/items.json').then((module) => module.default))
const chargerArmes = () => (armes ??= import('../data/armes.json').then((module) => module.default))

function useChargement<T>(charger: () => Promise<T[]>): { items: T[] | null; erreur: string | null } {
  const [lignes, setLignes] = useState<T[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    charger()
      .then((catalogue) => actif && setLignes(catalogue))
      .catch((e: Error) => actif && setErreur(e.message))
    return () => {
      actif = false
    }
  }, [charger])

  return { items: lignes, erreur }
}

export function useCatalogue() {
  return useChargement(chargerItems)
}

export function useArmes() {
  return useChargement(chargerArmes)
}

const chargerModeles = () => (modeles ??= import('../data/vehicules.json').then((module) => module.default))

// Catalogue des véhicules de GTA V, pour les photos
export function useModelesVehicules() {
  return useChargement(chargerModeles)
}

// Items et armes réunis, pour le Stock
const chargerReferences = () =>
  (references ??= Promise.all([chargerItems(), chargerArmes()]).then(([lesItems, lesArmes]) => [
    ...lesItems.map((i): Reference => ({ ...i, cle: String(i.id), dossier: 'items' })),
    ...lesArmes.map((a): Reference => ({ ...a, cle: `arme-${a.id}`, dossier: 'weapons' })),
  ]))

export function useReferences() {
  return useChargement(chargerReferences)
}
