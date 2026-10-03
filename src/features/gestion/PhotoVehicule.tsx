import { ImageVehicule } from '../../components/ImageVehicule'
import type { Vehicule } from '../../types'
import { useModeleDe } from './useModeleDe'

// Vignette d'un véhicule du groupe ; cadre vide si son modèle n'est pas dans le catalogue
export function PhotoVehicule({ vehicule, className }: { vehicule: Pick<Vehicule, 'spawn' | 'modele'>; className?: string }) {
  return <ImageVehicule spawn={useModeleDe(vehicule)?.spawn} className={className} />
}
