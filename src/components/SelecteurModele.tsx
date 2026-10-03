import { libelleClasse, normaliser } from '../features/gestion/modeles'
import type { ModeleVehicule } from '../types'
import { ImageVehicule } from './ImageVehicule'
import { Button, inputClass } from './ui'

const SUGGESTIONS_MAX = 6

// Choix du modèle d'un véhicule : on tape, le catalogue propose des modèles avec leur photo.
// Garder le texte tapé sans choisir de suggestion reste possible (véhicule propre au serveur, sans photo) :
// `spawn` vaut alors null.
export function SelecteurModele({
  catalogue,
  modele,
  spawn,
  onChange,
}: {
  catalogue: ModeleVehicule[]
  modele: string
  spawn: string | null
  onChange: (valeur: { modele: string; spawn: string | null }) => void
}) {
  const choisi = spawn ? catalogue.find((m) => m.spawn === spawn) : undefined

  if (spawn) {
    return (
      <div className="flex items-center gap-3">
        <ImageVehicule spawn={spawn} className="h-16 w-28" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{modele}</p>
          {choisi && (
            <p className="text-xs text-zinc-500">
              {[choisi.marque, libelleClasse(choisi.classe)].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Button variant="ghost" onClick={() => onChange({ modele: '', spawn: null })}>
          Changer
        </Button>
      </div>
    )
  }

  const texte = normaliser(modele)
  const suggestions =
    texte.length < 2
      ? []
      : catalogue
          .filter((m) => normaliser(`${m.marque} ${m.nom}`).includes(texte) || m.spawn.includes(texte))
          .slice(0, SUGGESTIONS_MAX)

  return (
    <div className="space-y-1">
      <input
        className={inputClass}
        value={modele}
        maxLength={60}
        placeholder="Rechercher un modèle (nom ou marque)"
        required
        autoFocus
        onChange={(e) => onChange({ modele: e.target.value, spawn: null })}
      />
      {suggestions.length > 0 && (
        <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
          {suggestions.map((m) => (
            <li key={m.spawn}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-2 py-1.5 text-left text-sm hover:bg-zinc-800"
                onClick={() => onChange({ modele: m.nom, spawn: m.spawn })}
              >
                <ImageVehicule spawn={m.spawn} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-100">{m.nom}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {[m.marque, libelleClasse(m.classe)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">
        Choisis un modèle dans la liste pour avoir sa photo. Un véhicule absent du catalogue se garde tel que tu l’as tapé.
      </p>
    </div>
  )
}
