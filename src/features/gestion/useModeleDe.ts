import { useModelesVehicules } from '../../lib/useCatalogue'
import type { ModeleVehicule, Vehicule } from '../../types'
import { trouverModele } from './modeles'

// Modèle du catalogue correspondant à un véhicule du groupe (lien enregistré, ou rapprochement sur le texte saisi)
export function useModeleDe(vehicule: Pick<Vehicule, 'spawn' | 'modele'>): ModeleVehicule | undefined {
  const catalogue = useModelesVehicules()
  return trouverModele(vehicule, catalogue.items ?? [])
}
