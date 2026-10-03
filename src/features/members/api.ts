import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { nomAffiche } from '../../lib/roles'
import type { LogAction, Membre, RaisonRevocation, RaisonSuppression, Role } from '../../types'

function actionPour(ancien: Role, nouveau: Role): LogAction {
  if (nouveau === 'revoque') return ancien === 'pending' ? 'refus' : 'revocation'
  if (ancien === 'pending') return 'validation'
  if (ancien === 'revoque') return 'reintegration'
  return 'changement_role'
}

function entreeJournal(acteur: Membre, cible: Membre) {
  return {
    acteurUid: acteur.uid,
    acteurNom: nomAffiche(acteur),
    cibleUid: cible.uid,
    cibleNom: nomAffiche(cible),
    ancienRole: cible.role,
    createdAt: serverTimestamp(),
  }
}

// Changement de rôle + entrée du journal d'audit, dans le même batch
export async function changerRole(acteur: Membre, cible: Membre, nouveauRole: Exclude<Role, 'revoque'>): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', cible.uid), {
    role: nouveauRole,
    raisonRevocation: deleteField(),
    validatedBy: acteur.uid,
    validatedAt: serverTimestamp(),
  })
  batch.set(doc(collection(db, 'logs')), {
    ...entreeJournal(acteur, cible),
    action: actionPour(cible.role, nouveauRole),
    nouveauRole,
  })
  await batch.commit()
}

// Coupe l'accès en gardant la fiche : le joueur pourra être réintégré ou supprimé plus tard
export async function revoquer(acteur: Membre, cible: Membre, raison: RaisonRevocation): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', cible.uid), {
    role: 'revoque',
    raisonRevocation: raison,
    validatedBy: acteur.uid,
    validatedAt: serverTimestamp(),
  })
  // Un compte révoqué ne garde pas de droit admin : il ne doit pas le retrouver s'il est réintégré
  batch.delete(doc(db, 'users', cible.uid, 'prive', 'droits'))
  batch.set(doc(collection(db, 'logs')), {
    ...entreeJournal(acteur, cible),
    action: actionPour(cible.role, 'revoque'),
    nouveauRole: 'revoque',
    raison,
  })
  await batch.commit()
}

// ---- Droit d'administration ----
// Rangé dans users/{uid}/prive/droits, lisible par le joueur et les admins seulement. Rien n'est écrit au journal :
// il est lisible par N1 et N2, à qui ce droit doit rester invisible.

export async function lireDroitAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid, 'prive', 'droits'))
  return snap.data()?.admin === true
}

// Donne ou retire le droit admin à un autre membre (les règles refusent de le faire sur soi-même)
export async function definirAdmin(uid: string, admin: boolean): Promise<void> {
  const ref = doc(db, 'users', uid, 'prive', 'droits')
  if (admin) await setDoc(ref, { admin: true })
  else await deleteDoc(ref)
}

// Un admin change son propre grade RP, qui n'est qu'un affichage. Sans entrée au journal : un membre qui change
// seul de grade y trahirait son droit admin.
export async function changerSonGrade(uid: string, role: Exclude<Role, 'revoque'>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role, validatedBy: uid, validatedAt: serverTimestamp() })
}

// Migration d'une fiche encore à l'ancien grade « Admin » : elle reçoit le droit admin dans sa zone privée et
// prend un vrai grade RP, dans la même écriture (les règles n'acceptent pas l'un sans l'autre).
export async function migrerAdmin(uid: string, role: Exclude<Role, 'revoque'>): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid, 'prive', 'droits'), { admin: true })
  batch.update(doc(db, 'users', uid), { role, validatedBy: uid, validatedAt: serverTimestamp() })
  await batch.commit()
}

// Suppression définitive : fiche publique, zone privée et véhicules effacés, seule la ligne du journal reste
export async function supprimerJoueur(acteur: Membre, cible: Membre, raison: RaisonSuppression): Promise<void> {
  const vehicules = await getDocs(query(collection(db, 'vehicules'), where('proprietaireUid', '==', cible.uid)))
  const batch = writeBatch(db)
  vehicules.forEach((vehicule) => batch.delete(vehicule.ref))
  batch.delete(doc(db, 'users', cible.uid, 'prive', 'compte'))
  batch.delete(doc(db, 'users', cible.uid, 'prive', 'droits'))
  batch.delete(doc(db, 'users', cible.uid))
  batch.set(doc(collection(db, 'logs')), {
    ...entreeJournal(acteur, cible),
    action: 'suppression',
    nouveauRole: 'revoque',
    raison,
  })
  await batch.commit()
}

export async function majProfil(
  uid: string,
  profil: { nomRP: string; telephoneRP: string; anniversaireRP: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    nomRP: profil.nomRP.trim(),
    telephoneRP: profil.telephoneRP.trim(),
    anniversaireRP: profil.anniversaireRP.trim(),
  })
}

export async function basculerPresence(uid: string, present: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { present, presenceAt: serverTimestamp() })
}

// Email du compte, lisible uniquement par l'admin (et par le joueur lui-même)
export async function lireEmailPrive(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'prive', 'compte'))
  return (snap.data()?.email as string | undefined) ?? null
}
