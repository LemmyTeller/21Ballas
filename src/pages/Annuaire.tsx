import { useState } from 'react'
import { useMembre } from '../auth/AuthContext'
import { Button, Card, Chargement, ErrorMessage, inputClass } from '../components/ui'
import { ContactModal } from '../features/annuaire/ContactModal'
import { useContacts } from '../features/annuaire/useContacts'
import { TYPES_PARTENAIRE, TYPE_LABELS, TYPE_PLURIELS, comparerPartenaires } from '../features/tarifs/api'
import { PartenaireModal } from '../features/tarifs/PartenaireModal'
import { TuileCouleur } from '../features/tarifs/TuileCouleur'
import { usePartenaires } from '../features/tarifs/usePartenaires'
import { useTarifs } from '../features/tarifs/useTarifs'
import { aAuMoins } from '../lib/roles'
import type { Contact, Partenaire, TypePartenaire } from '../types'

// `tous`, un type d'organisation, ou `aucun` pour les contacts sans rattachement
type Filtre = 'tous' | TypePartenaire | 'aucun'

type Fenetre = { type: 'contact'; contact?: Contact } | { type: 'organisation'; partenaire?: Partenaire }

const FILTRES: { filtre: Filtre; label: string }[] = [
  { filtre: 'tous', label: 'Tous' },
  ...TYPES_PARTENAIRE.map((type) => ({ filtre: type, label: TYPE_PLURIELS[type] })),
  { filtre: 'aucun', label: 'Sans rattachement' },
]

export function Annuaire() {
  const moi = useMembre()
  const contacts = useContacts()
  const partenaires = usePartenaires()
  // Seulement pour annoncer, à la suppression d'une organisation, combien de lignes de tarif partent avec elle
  const tarifs = useTarifs()
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [fenetre, setFenetre] = useState<Fenetre | null>(null)

  const estGrade = aAuMoins(moi.role, 'n2')
  // Un contact dont le partenaire a disparu compte comme sans rattachement
  const organisation = (contact: Contact) => partenaires.data.find((p) => p.id === contact.partenaireId)

  const terme = recherche.trim().toLocaleLowerCase('fr')
  const visibles = contacts.data
    .map((contact) => ({ contact, org: organisation(contact) }))
    .filter(({ contact: c, org }) => {
      if (filtre === 'aucun' ? org : filtre !== 'tous' && org?.type !== filtre) return false
      return `${c.nom} ${c.telephone} ${c.role} ${org?.nom ?? ''}`.toLocaleLowerCase('fr').includes(terme)
    })
    // Par organisation : le Cartel d'abord, puis l'ordre alphabétique, les contacts sans rattachement à la fin ;
    // dans une même organisation, par nom
    .sort((a, b) => {
      if (a.org && b.org) return comparerPartenaires(a.org, b.org) || a.contact.nom.localeCompare(b.contact.nom, 'fr')
      if (a.org || b.org) return a.org ? -1 : 1
      return a.contact.nom.localeCompare(b.contact.nom, 'fr')
    })

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Annuaire</h1>
          <p className="text-sm text-zinc-400">Contacts du Cartel, des groupes, petites mains et entreprises.</p>
        </div>
        {estGrade && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFenetre({ type: 'organisation' })}>
              + Organisation
            </Button>
            <Button onClick={() => setFenetre({ type: 'contact' })}>+ Contact</Button>
          </div>
        )}
      </header>

      <ErrorMessage>{contacts.error ?? partenaires.error ?? tarifs.error}</ErrorMessage>

      <Card>
        {contacts.loading || partenaires.loading ? (
          <Chargement />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                className={`${inputClass} max-w-xs`}
                placeholder="Nom, téléphone, rôle, organisation"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {FILTRES.map(({ filtre: f, label }) => (
                  <button
                    key={f}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      filtre === f ? 'bg-purple-800 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                    onClick={() => setFiltre(f)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-sm text-zinc-500">
                {visibles.length} contact{visibles.length > 1 ? 's' : ''}
              </span>
            </div>

            {visibles.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {contacts.data.length === 0 ? 'Aucun contact pour le moment.' : 'Aucun contact ne correspond.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs tracking-wide text-zinc-500 uppercase">
                    <tr>
                      <th className="pb-2 font-medium">Organisation</th>
                      <th className="pb-2 font-medium">Nom</th>
                      <th className="pb-2 font-medium">Téléphone</th>
                      <th className="pb-2 font-medium">Rôle</th>
                      <th className="pb-2 font-medium">Informations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {visibles.map(({ contact, org }) => (
                      <tr
                        key={contact.id}
                        className={estGrade ? 'cursor-pointer align-top hover:bg-zinc-800/50' : 'align-top'}
                        onClick={estGrade ? () => setFenetre({ type: 'contact', contact }) : undefined}
                      >
                        <td className="py-2.5 pr-4">
                          {org ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <TuileCouleur partenaire={org} className="size-4" />
                              {estGrade ? (
                                // Le nom ouvre l'organisation (couleur, type…), pas le contact
                                <button
                                  type="button"
                                  title="Modifier l’organisation"
                                  className="text-zinc-100 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFenetre({ type: 'organisation', partenaire: org })
                                  }}
                                >
                                  {org.nom}
                                </button>
                              ) : (
                                <span className="text-zinc-100">{org.nom}</span>
                              )}
                              <span className="text-xs text-zinc-500">{TYPE_LABELS[org.type]}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-medium whitespace-nowrap text-zinc-100">{contact.nom}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-zinc-300 tabular-nums">
                          {contact.telephone || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-300">{contact.role || '—'}</td>
                        <td className="py-2.5 whitespace-pre-wrap text-zinc-400">{contact.informations || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {fenetre?.type === 'contact' && (
        <ContactModal contact={fenetre.contact} partenaires={partenaires.data} onClose={() => setFenetre(null)} />
      )}
      {fenetre?.type === 'organisation' && (
        <PartenaireModal partenaire={fenetre.partenaire} tarifs={tarifs.data} onClose={() => setFenetre(null)} />
      )}
    </>
  )
}
