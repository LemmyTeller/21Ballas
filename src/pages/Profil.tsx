import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage } from '../components/ui'
import { SoldeForm } from '../features/gestion/SoldeForm'
import { useLieux } from '../features/gestion/useLieux'
import { useVehicules } from '../features/gestion/useVehicules'
import { VehiculeModal } from '../features/gestion/VehiculeModal'
import { ProfilForm } from '../features/members/ProfilForm'
import type { Vehicule } from '../types'

// Page Paramètres : tout ce que le joueur saisit lui-même, relu ensuite dans l'onglet Gestion
export function Profil() {
  const membre = useMembre()
  const vehicules = useVehicules()
  const lieux = useLieux()
  // `null` : fenêtre fermée ; `{}` : ajout ; `{ vehicule }` : modification
  const [fenetre, setFenetre] = useState<{ vehicule?: Vehicule } | null>(null)

  const miens = vehicules.data
    .filter((v) => v.proprietaireUid === membre.uid)
    .sort((a, b) => a.modele.localeCompare(b.modele, 'fr'))

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-zinc-50">Paramètres</h1>
        <p className="text-sm text-zinc-400">
          Seules ces informations RP sont visibles par les autres membres, dans les onglets Membres et Gestion.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Profil RP">
          <ProfilForm membre={membre} />
        </Card>
        <Card title="Compte bancaire">
          <SoldeForm membre={membre} />
        </Card>
      </div>

      <Card title="Mes véhicules" action={<Button onClick={() => setFenetre({})}>+ Ajouter un véhicule</Button>}>
        <ErrorMessage>{vehicules.error ?? lieux.error}</ErrorMessage>
        {vehicules.loading || lieux.loading ? (
          <Chargement />
        ) : miens.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun véhicule enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-2 font-medium">Modèle</th>
                  <th className="pb-2 font-medium">Plaque</th>
                  <th className="pb-2 font-medium">Garage</th>
                  <th className="pb-2 font-medium">Note</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {miens.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2.5 pr-4 font-medium text-zinc-100">{v.modele}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-zinc-300">{v.plaque || '—'}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">
                      {lieux.data.find((l) => l.id === v.lieuId)?.nom ?? 'Sans garage'}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-400">{v.note || '—'}</td>
                    <td className="py-2.5 text-right">
                      <Button variant="ghost" onClick={() => setFenetre({ vehicule: v })}>
                        Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {fenetre && (
        <VehiculeModal
          vehicule={fenetre.vehicule}
          proprietaireUid={membre.uid}
          lieux={lieux.data}
          vehicules={vehicules.data}
          onClose={() => setFenetre(null)}
        />
      )}
    </>
  )
}
