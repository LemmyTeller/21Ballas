import { onAuthStateChanged, type User } from 'firebase/auth'
import { deleteField, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { auth, db } from '../lib/firebase'
import type { Membre } from '../types'
import { AuthContext } from './AuthContext'

// Anciennes clés personnelles, retirées de la fiche publique
const CLES_PERSONNELLES = ['email', 'displayName', 'photoURL']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [membre, setMembre] = useState<Membre | null>(null)
  // null : pas encore lu
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Évite de retenter la création ou la migration en boucle si les règles la refusent
  const ecritureTentee = useRef<string | null>(null)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setMembre(null)
        setAdmin(null)
        setError(null)
        setLoading(u !== null)
      }),
    [],
  )

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    const prive = doc(db, 'users', user.uid, 'prive', 'compte')

    return onSnapshot(
      ref,
      (snap) => {
        const data = snap.data()

        if (data) {
          setMembre({
            uid: snap.id,
            nomRP: data.nomRP ?? '',
            telephoneRP: data.telephoneRP ?? '',
            anniversaireRP: data.anniversaireRP,
            compteBancaire: data.compteBancaire,
            role: data.role,
            raisonRevocation: data.raisonRevocation,
            createdAt: data.createdAt ?? null,
            validatedBy: data.validatedBy,
            validatedAt: data.validatedAt,
            present: data.present,
            presenceAt: data.presenceAt,
          })
          setLoading(false)
          // Fiche confirmée par le serveur : si elle est supprimée plus tard, une nouvelle demande pourra être créée
          if (!snap.metadata.hasPendingWrites && !CLES_PERSONNELLES.some((cle) => cle in data)) {
            ecritureTentee.current = null
          }

          // Fiche créée avant la séparation : on sort les données personnelles de la fiche publique
          if (CLES_PERSONNELLES.some((cle) => cle in data) && ecritureTentee.current !== user.uid) {
            ecritureTentee.current = user.uid
            const batch = writeBatch(db)
            batch.update(ref, { email: deleteField(), displayName: deleteField(), photoURL: deleteField() })
            batch.set(prive, { email: user.email })
            batch.commit().catch((e: Error) => console.error('Migration de la fiche impossible', e))
          }
          return
        }

        // Première connexion, ou joueur supprimé du groupe : fiche publique en attente + email dans la zone privée
        setMembre(null)
        if (ecritureTentee.current === user.uid) return
        ecritureTentee.current = user.uid
        setLoading(true)
        const batch = writeBatch(db)
        batch.set(ref, { nomRP: '', telephoneRP: '', role: 'pending', createdAt: serverTimestamp() })
        batch.set(prive, { email: user.email })
        batch.commit().catch((e: Error) => {
          setError(`Création du compte impossible : ${e.message}`)
          setLoading(false)
        })
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
  }, [user])

  // Droit d'administration : lu dans sa propre zone privée, que les autres membres ne peuvent pas lire
  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid, 'prive', 'droits'),
      (snap) => setAdmin(snap.data()?.admin === true),
      () => setAdmin(false),
    )
  }, [user])

  // Tant que le droit admin n'est pas connu, l'appli attend : sinon un admin au petit grade serait d'abord
  // traité comme un simple membre, et renvoyé des pages réservées
  const pret = !loading && (membre === null || admin !== null)

  return (
    <AuthContext value={{ user, membre: membre && { ...membre, admin: admin === true }, loading: !pret, error }}>
      {children}
    </AuthContext>
  )
}
