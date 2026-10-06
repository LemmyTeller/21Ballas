// Tests des règles Firestore. Nécessite l'émulateur : `npm run test:rules`.
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const fiche = (role: string) => ({ nomRP: '', telephoneRP: '', role, createdAt: new Date() })
const emailDe = (uid: string) => `${uid}@test.dev`
const dbDe = (uid: string) => env.authenticatedContext(uid, { email: emailDe(uid) }).firestore()

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ballas',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const [uid, role] of [
      ['admin', 'admin'],
      ['admin2', 'admin'],
      ['n1', 'n1'],
      ['n1bis', 'n1'],
      ['n2', 'n2'],
      ['n2bis', 'n2'],
      ['violet', 'officier'],
      ['noir', 'membre'],
      ['attente', 'pending'],
      ['banni', 'revoque'],
    ]) {
      await setDoc(doc(db, 'users', uid), fiche(role))
      await setDoc(doc(db, 'users', uid, 'prive', 'compte'), { email: emailDe(uid) })
    }
    // Admin au grade Masque noir : le droit vit dans sa zone privée, rien ne le montre sur sa fiche
    await setDoc(doc(db, 'users', 'cache'), fiche('membre'))
    await setDoc(doc(db, 'users', 'cache', 'prive', 'droits'), { admin: true })
    // Fiche d'avant la séparation, avec des données personnelles
    await setDoc(doc(db, 'users', 'ancien'), {
      ...fiche('membre'),
      email: emailDe('ancien'),
      displayName: 'Vrai Nom',
      photoURL: null,
    })
    await setDoc(doc(db, 'annonces', 'a1'), {
      titre: 'Réunion',
      contenu: '',
      auteurUid: 'violet',
      auteurNom: 'Violet',
      createdAt: new Date(),
    })
    await setDoc(doc(db, 'logs', 'l1'), { action: 'validation', acteurUid: 'n1', createdAt: new Date() })
  })
})

afterAll(() => env.cleanup())

describe('users : création', () => {
  const nouvelle = (role: string) => ({ ...fiche(role), createdAt: serverTimestamp() })

  it('un nouveau compte se crée en pending', async () => {
    await assertSucceeds(setDoc(doc(dbDe('nouveau'), 'users', 'nouveau'), nouvelle('pending')))
  })
  it('impossible de se créer directement gradé ou membre', async () => {
    for (const role of ['admin', 'n1', 'n2', 'officier', 'membre']) {
      await assertFails(setDoc(doc(dbDe('nouveau'), 'users', 'nouveau'), nouvelle(role)))
    }
  })
  it('impossible de créer la fiche de quelqu’un d’autre', async () => {
    await assertFails(setDoc(doc(dbDe('nouveau'), 'users', 'autre'), nouvelle('pending')))
  })
  it('aucune donnée personnelle dans la fiche publique', async () => {
    await assertFails(
      setDoc(doc(dbDe('nouveau'), 'users', 'nouveau'), { ...nouvelle('pending'), email: emailDe('nouveau') }),
    )
    await assertFails(
      setDoc(doc(dbDe('nouveau'), 'users', 'nouveau'), { ...nouvelle('pending'), displayName: 'Vrai Nom' }),
    )
  })
  it('sans authentification, rien', async () => {
    const anonyme = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anonyme, 'users', 'n1')))
    await assertFails(getDocs(collection(anonyme, 'annonces')))
  })
})

describe('zone privée', () => {
  const compte = (db: ReturnType<typeof dbDe>, uid: string) => doc(db, 'users', uid, 'prive', 'compte')

  it('chacun écrit son propre email, et seulement le sien', async () => {
    await assertSucceeds(setDoc(compte(dbDe('nouveau'), 'nouveau'), { email: emailDe('nouveau') }))
    await assertFails(setDoc(compte(dbDe('nouveau'), 'nouveau'), { email: 'usurpe@test.dev' }))
    await assertFails(setDoc(compte(dbDe('nouveau'), 'noir'), { email: emailDe('nouveau') }))
  })
  it('lisible par soi-même et par l’admin uniquement', async () => {
    await assertSucceeds(getDoc(compte(dbDe('noir'), 'noir')))
    await assertSucceeds(getDoc(compte(dbDe('admin'), 'noir')))
    for (const uid of ['n1', 'n2', 'violet', 'attente']) {
      await assertFails(getDoc(compte(dbDe(uid), 'noir')))
    }
  })
})

describe('users : lecture', () => {
  it('un pending ou un révoqué lit sa fiche mais pas celles des autres', async () => {
    for (const uid of ['attente', 'banni']) {
      await assertSucceeds(getDoc(doc(dbDe(uid), 'users', uid)))
      await assertFails(getDoc(doc(dbDe(uid), 'users', 'n1')))
      await assertFails(getDocs(collection(dbDe(uid), 'users')))
    }
  })
  it('un membre validé lit la liste', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'users')))
  })
})

describe('users : profil et présence', () => {
  it('chacun modifie son profil RP', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('attente'), 'users', 'attente'), { nomRP: 'Jamal', telephoneRP: '555' }))
  })
  it('chacun déclare sa propre présence, à l’heure du serveur', async () => {
    const moi = doc(dbDe('noir'), 'users', 'noir')
    await assertSucceeds(updateDoc(moi, { present: true, presenceAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(moi, { present: false, presenceAt: serverTimestamp() }))
    await assertFails(updateDoc(moi, { present: true, presenceAt: new Date(2030, 0, 1) }))
    await assertFails(updateDoc(moi, { present: 'oui', presenceAt: serverTimestamp() }))
  })
  it('personne ne déclare la présence d’un autre, même un admin', async () => {
    const presence = { present: true, presenceAt: serverTimestamp() }
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), presence))
    await assertFails(updateDoc(doc(dbDe('admin'), 'users', 'noir'), presence))
  })
  it('les anciennes données personnelles ne peuvent qu’être supprimées', async () => {
    const moi = doc(dbDe('ancien'), 'users', 'ancien')
    await assertFails(updateDoc(moi, { displayName: 'Autre Nom' }))
    await assertSucceeds(
      updateDoc(moi, { email: deleteField(), displayName: deleteField(), photoURL: deleteField() }),
    )
    await assertFails(updateDoc(moi, { email: emailDe('ancien') }))
  })
  it('un gradé ne modifie pas le profil d’un autre', async () => {
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), { nomRP: 'Faux' }))
    await assertFails(updateDoc(doc(dbDe('admin'), 'users', 'noir'), { nomRP: 'Faux' }))
  })
})

describe('users : révocation avec raison', () => {
  const revocation = (par: string, raison?: string) => ({
    role: 'revoque',
    validatedBy: par,
    validatedAt: serverTimestamp(),
    ...(raison ? { raisonRevocation: raison } : {}),
  })

  it('une révocation exige une raison connue', async () => {
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), revocation('n1')))
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), revocation('n1', 'mort')))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'users', 'noir'), revocation('n1', 'cavale')))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'users', 'violet'), revocation('n1', 'absence')))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'users', 'attente'), revocation('n1', 'refus')))
  })
  it('le joueur révoqué lit sa raison, et la réintégration l’efface', async () => {
    await updateDoc(doc(dbDe('n1'), 'users', 'noir'), revocation('n1', 'cavale'))
    await assertSucceeds(getDoc(doc(dbDe('noir'), 'users', 'noir')))
    const retour = { role: 'membre', validatedBy: 'n1', validatedAt: serverTimestamp() }
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), retour))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'users', 'noir'), { ...retour, raisonRevocation: deleteField() }))
  })
})

describe('users : suppression définitive', () => {
  const fiche = (db: ReturnType<typeof dbDe>, uid: string) => doc(db, 'users', uid)
  const compte = (db: ReturnType<typeof dbDe>, uid: string) => doc(db, 'users', uid, 'prive', 'compte')

  it('les Masques ne suppriment personne, et personne ne se supprime soi-même', async () => {
    await assertFails(deleteDoc(fiche(dbDe('violet'), 'noir')))
    await assertFails(deleteDoc(fiche(dbDe('noir'), 'noir')))
    await assertFails(deleteDoc(fiche(dbDe('admin'), 'admin')))
  })
  it('un gradé supprime un joueur de rang inférieur, fiche et zone privée', async () => {
    await assertSucceeds(deleteDoc(compte(dbDe('n2'), 'noir')))
    await assertSucceeds(deleteDoc(fiche(dbDe('n2'), 'noir')))
    await assertSucceeds(deleteDoc(fiche(dbDe('n2'), 'banni')))
    await assertSucceeds(deleteDoc(fiche(dbDe('n1'), 'n2')))
  })
  it('un gradé ne supprime ni son égal ni son supérieur', async () => {
    await assertFails(deleteDoc(fiche(dbDe('n2'), 'n2bis')))
    await assertFails(deleteDoc(fiche(dbDe('n2'), 'n1')))
    await assertFails(deleteDoc(compte(dbDe('n2'), 'n1')))
    await assertFails(deleteDoc(fiche(dbDe('n1'), 'admin')))
  })
  it('un admin supprime n’importe qui d’autre', async () => {
    await assertSucceeds(deleteDoc(fiche(dbDe('admin'), 'n1')))
    await assertSucceeds(deleteDoc(fiche(dbDe('admin'), 'admin2')))
  })
  it('le compte supprimé peut refaire une demande', async () => {
    await deleteDoc(fiche(dbDe('n2'), 'noir'))
    await assertSucceeds(
      setDoc(fiche(dbDe('noir'), 'noir'), { nomRP: '', telephoneRP: '', role: 'pending', createdAt: serverTimestamp() }),
    )
  })
})

describe('users : grades', () => {
  const grade = (role: string, par: string) => ({
    role,
    validatedBy: par,
    validatedAt: serverTimestamp(),
    ...(role === 'revoque' ? { raisonRevocation: 'cavale' } : {}),
  })
  const changer = (par: string, cible: string, role: string) =>
    updateDoc(doc(dbDe(par), 'users', cible), grade(role, par))

  it('personne ne modifie son propre grade', async () => {
    await assertFails(updateDoc(doc(dbDe('attente'), 'users', 'attente'), { role: 'membre' }))
    for (const uid of ['noir', 'violet', 'n2', 'n1', 'admin']) {
      await assertFails(changer(uid, uid, 'membre'))
    }
  })
  it('les Masques ne gèrent personne', async () => {
    await assertFails(changer('noir', 'attente', 'membre'))
    await assertFails(changer('violet', 'attente', 'membre'))
    await assertFails(changer('violet', 'noir', 'revoque'))
  })
  it('N2 valide, promeut jusqu’à Masque violet et révoque les Masques', async () => {
    await assertSucceeds(changer('n2', 'attente', 'membre'))
    await assertSucceeds(changer('n2', 'noir', 'officier'))
    await assertSucceeds(changer('n2', 'violet', 'revoque'))
    await assertSucceeds(changer('n2', 'banni', 'membre'))
  })
  it('N2 ne nomme pas de N2 et ne touche ni N2, ni N1, ni admin', async () => {
    await assertFails(changer('n2', 'noir', 'n2'))
    await assertFails(changer('n2', 'noir', 'n1'))
    await assertFails(changer('n2', 'n2bis', 'membre'))
    await assertFails(changer('n2', 'n1', 'membre'))
    await assertFails(changer('n2', 'admin', 'revoque'))
  })
  it('N1 gère N2 et les Masques', async () => {
    await assertSucceeds(changer('n1', 'noir', 'n2'))
    await assertSucceeds(changer('n1', 'n2', 'officier'))
    await assertSucceeds(changer('n1', 'n2bis', 'revoque'))
  })
  it('N1 ne nomme pas de N1 et ne touche ni N1, ni admin', async () => {
    await assertFails(changer('n1', 'noir', 'n1'))
    await assertFails(changer('n1', 'noir', 'admin'))
    await assertFails(changer('n1', 'n1bis', 'membre'))
    await assertFails(changer('n1', 'admin', 'membre'))
  })
  it('un admin gère tous les grades, y compris N1 et admin', async () => {
    await assertSucceeds(changer('admin', 'attente', 'membre'))
    await assertSucceeds(changer('admin', 'n1', 'n2'))
    await assertSucceeds(changer('admin', 'admin2', 'revoque'))
  })
  it('« admin » n’est plus un grade attribuable', async () => {
    await assertFails(changer('admin', 'noir', 'admin'))
    await assertFails(changer('cache', 'noir', 'admin'))
  })
  it('on ne signe pas pour un autre et on n’invente pas de grade', async () => {
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'noir'), grade('officier', 'n1bis')))
    await assertFails(changer('admin', 'noir', 'chef'))
    await assertFails(changer('admin', 'noir', 'pending'))
  })
  it('un membre révoqué perd l’accès immédiatement', async () => {
    await changer('n1', 'noir', 'revoque')
    await assertFails(getDocs(collection(dbDe('noir'), 'users')))
  })
})

describe('droit admin, séparé du grade', () => {
  const droits = (db: ReturnType<typeof dbDe>, uid: string) => doc(db, 'users', uid, 'prive', 'droits')
  const grade = (role: string, par: string) => ({ role, validatedBy: par, validatedAt: serverTimestamp() })

  it('un admin au grade Masque noir a tous les droits', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('cache'), 'users', 'n1'), grade('n2', 'cache')))
    await assertSucceeds(getDoc(doc(dbDe('cache'), 'users', 'noir', 'prive', 'compte')))
    await assertSucceeds(getDocs(collection(dbDe('cache'), 'logs')))
    await assertSucceeds(deleteDoc(doc(dbDe('cache'), 'users', 'n1bis')))
  })
  it('le droit est invisible : seuls le joueur et les admins le lisent', async () => {
    await assertSucceeds(getDoc(droits(dbDe('cache'), 'cache')))
    await assertSucceeds(getDoc(droits(dbDe('admin'), 'cache')))
    for (const uid of ['n1', 'n2', 'violet', 'noir']) {
      await assertFails(getDoc(droits(dbDe(uid), 'cache')))
    }
  })
  it('N1 et N2 ne touchent pas un admin, même affiché Masque noir', async () => {
    await assertFails(updateDoc(doc(dbDe('n1'), 'users', 'cache'), grade('officier', 'n1')))
    await assertFails(
      updateDoc(doc(dbDe('n1'), 'users', 'cache'), { ...grade('revoque', 'n1'), raisonRevocation: 'cavale' }),
    )
    await assertFails(updateDoc(doc(dbDe('n2'), 'users', 'cache'), { compteBancaire: 10 }))
    await assertFails(deleteDoc(doc(dbDe('n1'), 'users', 'cache')))
    await assertFails(deleteDoc(droits(dbDe('n1'), 'cache')))
  })
  it('seul un admin donne ou retire le droit, et jamais à lui-même', async () => {
    await assertSucceeds(setDoc(droits(dbDe('cache'), 'noir'), { admin: true }))
    await assertSucceeds(deleteDoc(droits(dbDe('cache'), 'noir')))
    await assertFails(setDoc(droits(dbDe('n1'), 'noir'), { admin: true }))
    await assertFails(setDoc(droits(dbDe('noir'), 'noir'), { admin: true }))
    await assertFails(setDoc(droits(dbDe('cache'), 'noir'), { admin: true, autre: 1 }))
    await assertFails(deleteDoc(droits(dbDe('cache'), 'cache')))
    await assertFails(setDoc(droits(dbDe('cache'), 'cache'), { admin: false }))
  })
  it('un admin change son propre grade, sans pouvoir se révoquer', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('cache'), 'users', 'cache'), grade('n1', 'cache')))
    await assertFails(updateDoc(doc(dbDe('cache'), 'users', 'cache'), grade('revoque', 'cache')))
    await assertFails(updateDoc(doc(dbDe('cache'), 'users', 'cache'), grade('admin', 'cache')))
  })
  it('un droit laissé sur un compte en attente ou révoqué ne donne rien', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'banni', 'prive', 'droits'), { admin: true })
    })
    await assertFails(getDocs(collection(dbDe('banni'), 'users')))
  })
  it('migration : l’ancien grade admin devient un droit privé et un grade RP, ensemble', async () => {
    const db = dbDe('admin')
    // Le grade seul, sans le droit : refusé
    await assertFails(updateDoc(doc(db, 'users', 'admin'), grade('membre', 'admin')))
    const batch = writeBatch(db)
    batch.set(droits(db, 'admin'), { admin: true })
    batch.update(doc(db, 'users', 'admin'), grade('membre', 'admin'))
    await assertSucceeds(batch.commit())
    // Toujours admin après la migration
    await assertSucceeds(updateDoc(doc(db, 'users', 'n1'), grade('n2', 'admin')))
  })
})

describe('gestion : solde et anniversaire', () => {
  it('chacun saisit son solde et son anniversaire', async () => {
    const moi = doc(dbDe('noir'), 'users', 'noir')
    await assertSucceeds(updateDoc(moi, { compteBancaire: 150000, anniversaireRP: '21/10' }))
    await assertSucceeds(updateDoc(moi, { anniversaireRP: '' }))
    await assertFails(updateDoc(moi, { compteBancaire: -5 }))
    await assertFails(updateDoc(moi, { compteBancaire: 'beaucoup' }))
    await assertFails(updateDoc(moi, { anniversaireRP: '32/01' }))
    await assertFails(updateDoc(moi, { anniversaireRP: '1 janvier' }))
  })
  it('un grade supérieur corrige le solde, et rien d’autre', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'users', 'noir'), { compteBancaire: 10 }))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'users', 'n2'), { compteBancaire: 10 }))
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'users', 'n1'), { compteBancaire: 10 }))
    await assertFails(updateDoc(doc(dbDe('n2'), 'users', 'noir'), { compteBancaire: 10, anniversaireRP: '01/01' }))
  })
  it('ni un Masque, ni un égal, ni un inférieur ne corrige le solde d’un autre', async () => {
    await assertFails(updateDoc(doc(dbDe('violet'), 'users', 'noir'), { compteBancaire: 10 }))
    await assertFails(updateDoc(doc(dbDe('n2'), 'users', 'n2bis'), { compteBancaire: 10 }))
    await assertFails(updateDoc(doc(dbDe('n2'), 'users', 'n1'), { compteBancaire: 10 }))
  })
})

describe('gestion : véhicules', () => {
  const vehicule = (proprietaireUid: string) => ({
    modele: 'Sultan',
    plaque: '49HGY747',
    proprietaireUid,
    lieuId: null,
    note: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const modif = (proprietaireUid: string) => ({ lieuId: 'qg', proprietaireUid, updatedAt: serverTimestamp() })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const base = { modele: 'Kuruma', plaque: '', lieuId: null, note: '', createdAt: new Date(), updatedAt: new Date() }
      await setDoc(doc(ctx.firestore(), 'vehicules', 'v-noir'), { ...base, proprietaireUid: 'noir' })
      await setDoc(doc(ctx.firestore(), 'vehicules', 'v-n1'), { ...base, proprietaireUid: 'n1' })
    })
  })

  it('lecture réservée aux comptes validés', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'vehicules')))
    await assertFails(getDocs(collection(dbDe('attente'), 'vehicules')))
  })
  it('chacun ajoute ses propres véhicules', async () => {
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'vehicules', 'x1'), vehicule('noir')))
    await assertFails(setDoc(doc(dbDe('attente'), 'vehicules', 'x2'), vehicule('attente')))
    await assertFails(setDoc(doc(dbDe('noir'), 'vehicules', 'x3'), { ...vehicule('noir'), modele: '' }))
    // Lien facultatif au catalogue des véhicules, pour la photo
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'vehicules', 'x4'), { ...vehicule('noir'), spawn: 'sultan' }))
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'vehicules', 'x5'), { ...vehicule('noir'), spawn: null }))
    await assertFails(setDoc(doc(dbDe('noir'), 'vehicules', 'x6'), { ...vehicule('noir'), spawn: 42 }))
  })
  it('seul l’admin ajoute un véhicule à quelqu’un d’autre', async () => {
    await assertFails(setDoc(doc(dbDe('noir'), 'vehicules', 'x1'), vehicule('violet')))
    await assertFails(setDoc(doc(dbDe('n1'), 'vehicules', 'x2'), vehicule('noir')))
    await assertSucceeds(setDoc(doc(dbDe('admin'), 'vehicules', 'x3'), vehicule('noir')))
  })
  it('le propriétaire modifie le sien sans pouvoir le donner ; l’admin modifie tout', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('noir'), 'vehicules', 'v-noir'), modif('noir')))
    await assertFails(updateDoc(doc(dbDe('noir'), 'vehicules', 'v-noir'), modif('violet')))
    await assertFails(updateDoc(doc(dbDe('violet'), 'vehicules', 'v-noir'), modif('noir')))
    await assertFails(updateDoc(doc(dbDe('n1'), 'vehicules', 'v-noir'), modif('noir')))
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'vehicules', 'v-noir'), modif('violet')))
  })
  it('suppression : le propriétaire, l’admin, ou un gradé de rang supérieur au propriétaire', async () => {
    await assertFails(deleteDoc(doc(dbDe('violet'), 'vehicules', 'v-noir')))
    await assertFails(deleteDoc(doc(dbDe('n2'), 'vehicules', 'v-n1')))
    await assertSucceeds(deleteDoc(doc(dbDe('n2'), 'vehicules', 'v-noir')))
    await assertSucceeds(deleteDoc(doc(dbDe('n1'), 'vehicules', 'v-n1')))
  })
})

describe('gestion : lieux', () => {
  const lieu = (capacite: unknown = 12) => ({ nom: 'QG', capacite, createdAt: serverTimestamp() })

  it('lecture par les comptes validés, écriture par les gradés', async () => {
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'lieux', 'qg'), lieu()))
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'lieux')))
    await assertFails(getDocs(collection(dbDe('attente'), 'lieux')))
    await assertFails(setDoc(doc(dbDe('violet'), 'lieux', 'autre'), lieu()))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'lieux', 'qg'), { capacite: 14 }))
    await assertFails(deleteDoc(doc(dbDe('violet'), 'lieux', 'qg')))
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'lieux', 'qg')))
  })
  it('capacité entière et positive', async () => {
    await assertFails(setDoc(doc(dbDe('n2'), 'lieux', 'a'), lieu(-1)))
    await assertFails(setDoc(doc(dbDe('n2'), 'lieux', 'b'), lieu(2.5)))
    await assertFails(setDoc(doc(dbDe('n2'), 'lieux', 'c'), lieu('douze')))
  })
})

describe('stock', () => {
  const categorie = () => ({ nom: 'Armes', createdAt: serverTimestamp() })
  const article = (quantites: unknown = { qg: 3 }) => ({
    categorieId: 'c1',
    quantites,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'categoriesStock', 'c1'), { nom: 'Drogue', createdAt: new Date() })
      await setDoc(doc(db, 'articles', '12'), {
        categorieId: 'c1',
        quantites: { qg: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await setDoc(doc(db, 'prixArticles', '12'), { prixAchat: 100, prixVente: null })
    })
  })

  it('tous les comptes validés lisent catégories et quantités', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'categoriesStock')))
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'articles')))
    await assertFails(getDocs(collection(dbDe('attente'), 'articles')))
  })
  it('tout membre validé modifie les quantités et crée un article non classé (saisie journalière)', async () => {
    const maj = (champs: Record<string, unknown>) => ({ ...champs, updatedAt: serverTimestamp() })
    await assertSucceeds(updateDoc(doc(dbDe('noir'), 'articles', '12'), maj({ 'quantites.qg': 99 })))
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'articles', '20'), { ...article(), categorieId: '' }))
    // … mais ne classe pas un article et n'en supprime pas
    await assertFails(setDoc(doc(dbDe('noir'), 'articles', '21'), article()))
    await assertFails(updateDoc(doc(dbDe('noir'), 'articles', '12'), maj({ categorieId: 'autre' })))
    await assertFails(deleteDoc(doc(dbDe('noir'), 'articles', '12')))
    await assertFails(updateDoc(doc(dbDe('attente'), 'articles', '12'), maj({ 'quantites.qg': 1 })))
  })
  it('seuls les gradés gèrent les catégories et classent les articles', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'categoriesStock', 'c2'), categorie()))
    await assertFails(setDoc(doc(dbDe('violet'), 'articles', '13'), article()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'categoriesStock', 'c2'), categorie()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'articles', '13'), article()))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'articles', '12'), { 'quantites.qg': 9, updatedAt: serverTimestamp() }))
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'articles', '12')))
  })
  it('données invalides refusées', async () => {
    await assertFails(setDoc(doc(dbDe('n2'), 'categoriesStock', 'c3'), { nom: '', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(dbDe('n2'), 'articles', '14'), article('beaucoup')))
  })
  it('anciens prix du Stock : plus aucune écriture, lecture et nettoyage par les gradés', async () => {
    await assertFails(getDoc(doc(dbDe('violet'), 'prixArticles', '12')))
    await assertSucceeds(getDoc(doc(dbDe('n2'), 'prixArticles', '12')))
    await assertFails(setDoc(doc(dbDe('admin'), 'prixArticles', '13'), { prixAchat: 50, prixVente: 80 }))
    await assertFails(updateDoc(doc(dbDe('admin'), 'prixArticles', '12'), { prixAchat: 1 }))
    await assertFails(deleteDoc(doc(dbDe('violet'), 'prixArticles', '12')))
    await assertSucceeds(deleteDoc(doc(dbDe('n2'), 'prixArticles', '12')))
  })
})

describe('tarifs', () => {
  const partenaire = (type: unknown = 'groupe') => ({
    nom: 'Vagos',
    type,
    telephone: '',
    note: '',
    createdAt: serverTimestamp(),
  })
  const tarif = (prixPropre: unknown = 100, prixSale: unknown = null) => ({
    partenaireId: 'p1',
    reference: '12',
    sens: 'achat',
    prixPropre,
    prixSale,
    note: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const modif = (champs: Record<string, unknown>) => ({ ...champs, updatedAt: serverTimestamp() })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'partenaires', 'p1'), { nom: 'Vagos', type: 'groupe', telephone: '', note: '', createdAt: new Date() })
      await setDoc(doc(db, 'tarifs', 'p1_vente_12'), {
        partenaireId: 'p1',
        reference: '12',
        sens: 'vente',
        prixPropre: 50,
        prixSale: 80,
        note: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })
  })

  it('tous les comptes validés consultent partenaires et tarifs', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'partenaires')))
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'tarifs')))
    await assertFails(getDocs(collection(dbDe('attente'), 'tarifs')))
  })
  it('seuls les gradés gèrent les partenaires', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'partenaires', 'p2'), partenaire()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'partenaires', 'p2'), partenaire('pm')))
    await assertFails(setDoc(doc(dbDe('n2'), 'partenaires', 'p3'), partenaire('allie')))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'partenaires', 'p1'), { nom: 'Families' }))
    await assertFails(deleteDoc(doc(dbDe('noir'), 'partenaires', 'p1')))
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'partenaires', 'p1')))
  })
  it('seuls les gradés gèrent les lignes, avec des prix facultatifs et positifs', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'tarifs', 'p1_achat_12'), tarif()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'tarifs', 'p1_achat_12'), tarif()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'tarifs', 'p1_achat_13'), tarif(null, null)))
    await assertFails(setDoc(doc(dbDe('n2'), 'tarifs', 'p1_achat_14'), tarif(-5)))
    await assertFails(setDoc(doc(dbDe('n2'), 'tarifs', 'p1_achat_15'), tarif('cher')))
    await assertFails(updateDoc(doc(dbDe('violet'), 'tarifs', 'p1_vente_12'), modif({ prixSale: 1 })))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'tarifs', 'p1_vente_12'), modif({ prixSale: 90, prixPropre: null })))
    await assertSucceeds(deleteDoc(doc(dbDe('n1'), 'tarifs', 'p1_vente_12')))
  })
  it('une ligne ne change ni de partenaire, ni de sens, ni d’item', async () => {
    await assertFails(updateDoc(doc(dbDe('admin'), 'tarifs', 'p1_vente_12'), modif({ sens: 'achat' })))
    await assertFails(updateDoc(doc(dbDe('admin'), 'tarifs', 'p1_vente_12'), modif({ reference: '99' })))
    await assertFails(updateDoc(doc(dbDe('admin'), 'tarifs', 'p1_vente_12'), modif({ partenaireId: 'p2' })))
  })
})

describe('saisie journalière', () => {
  const saisie = (quantites: unknown = { '71': 10000 }) => ({ quantites, updatedAt: serverTimestamp() })

  it('tout membre validé lit et alimente la saisie d’un jour', async () => {
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'saisies', '2026-10-03'), saisie()))
    await assertSucceeds(
      setDoc(doc(dbDe('violet'), 'saisies', '2026-10-03'), saisie({ '384': 5 }), { merge: true }),
    )
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'saisies')))
    await assertFails(setDoc(doc(dbDe('attente'), 'saisies', '2026-10-03'), saisie()))
    await assertFails(getDocs(collection(dbDe('attente'), 'saisies')))
  })
  it('identifiant de jour et contenu contrôlés, aucune suppression', async () => {
    await assertFails(setDoc(doc(dbDe('noir'), 'saisies', 'aujourdhui'), saisie()))
    await assertFails(setDoc(doc(dbDe('noir'), 'saisies', '2026-10-04'), saisie('beaucoup')))
    await setDoc(doc(dbDe('noir'), 'saisies', '2026-10-03'), saisie())
    await assertFails(deleteDoc(doc(dbDe('admin'), 'saisies', '2026-10-03')))
  })
})

describe('carjacking', () => {
  const fiche = (uid: string, champs: Record<string, unknown> = {}) => ({
    spawn: 'kuruma',
    modele: 'Kuruma',
    note: '',
    statut: 'a_voler',
    creeParUid: uid,
    createdAt: serverTimestamp(),
    ...champs,
  })
  const vol = (uid: string) => ({ statut: 'vole', voleParUid: uid, voleAt: serverTimestamp() })
  const depot = (uid: string) => ({ statut: 'depose', deposeParUid: uid, deposeAt: serverTimestamp() })
  const rachat = (uid: string) => ({
    statut: 'clos',
    rachete: true,
    montant: 5000,
    lieuId: 'qg',
    closParUid: uid,
    closAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const base = { spawn: 'kuruma', modele: 'Kuruma', note: '', creeParUid: 'n1', createdAt: new Date() }
      await setDoc(doc(db, 'carjackings', 'cj1'), { ...base, statut: 'a_voler' })
      await setDoc(doc(db, 'carjackings', 'volee'), { ...base, statut: 'vole', voleParUid: 'noir', voleAt: new Date() })
      await setDoc(doc(db, 'carjackings', 'deposee'), { ...base, statut: 'depose' })
      await setDoc(doc(db, 'carjackings', 'close'), { ...base, statut: 'clos' })
    })
  })

  it('tous consultent, seuls les gradés ajoutent une voiture', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'carjackings')))
    await assertFails(getDocs(collection(dbDe('attente'), 'carjackings')))
    await assertFails(setDoc(doc(dbDe('violet'), 'carjackings', 'x1'), fiche('violet')))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'carjackings', 'x2'), fiche('n2', { spawn: null, modele: 'Voiture du serveur' })))
    await assertFails(setDoc(doc(dbDe('n2'), 'carjackings', 'x3'), fiche('n2', { statut: 'vole' })))
    // Avec ou sans groupe demandeur
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'carjackings', 'x4'), fiche('n2', { partenaireId: 'p1' })))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'carjackings', 'x5'), fiche('n2', { partenaireId: null })))
  })
  it('tout membre validé vole puis dépose, en son nom et dans l’ordre', async () => {
    await assertFails(updateDoc(doc(dbDe('noir'), 'carjackings', 'cj1'), vol('violet')))
    await assertFails(updateDoc(doc(dbDe('noir'), 'carjackings', 'cj1'), depot('noir')))
    await assertSucceeds(updateDoc(doc(dbDe('noir'), 'carjackings', 'cj1'), vol('noir')))
    await assertSucceeds(updateDoc(doc(dbDe('violet'), 'carjackings', 'volee'), depot('violet')))
    await assertFails(updateDoc(doc(dbDe('attente'), 'carjackings', 'cj1'), vol('attente')))
  })
  it('seul un gradé renseigne le rachat, et une fiche close ne change plus', async () => {
    await assertFails(updateDoc(doc(dbDe('violet'), 'carjackings', 'deposee'), rachat('violet')))
    await assertFails(updateDoc(doc(dbDe('n2'), 'carjackings', 'cj1'), rachat('n2')))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'carjackings', 'deposee'), rachat('n2')))
    await assertFails(updateDoc(doc(dbDe('admin'), 'carjackings', 'close'), rachat('admin')))
    await assertFails(deleteDoc(doc(dbDe('admin'), 'carjackings', 'close')))
  })
  it('un gradé revient à l’étape précédente ou supprime une fiche en cours', async () => {
    const retour = { statut: 'a_voler', voleParUid: deleteField(), voleAt: deleteField() }
    await assertFails(updateDoc(doc(dbDe('noir'), 'carjackings', 'volee'), retour))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'carjackings', 'volee'), retour))
    await assertFails(deleteDoc(doc(dbDe('violet'), 'carjackings', 'cj1')))
    await assertSucceeds(deleteDoc(doc(dbDe('n1'), 'carjackings', 'cj1')))
  })
})

describe('blanchiment', () => {
  const commerce = (champs: Record<string, unknown> = {}) => ({
    zip: '9118',
    nom: '',
    description: '',
    proprietaireId: 'ballas',
    securise: true,
    taux: 80,
    dureeMinutes: 120,
    note: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...champs,
  })
  const depot = (uid: string, champs: Record<string, unknown> = {}) => ({
    commerceId: 'co1',
    commerceNom: 'Commerce 9118',
    montant: 10000,
    taux: 80,
    dureeMinutes: 120,
    debut: new Date(2026, 9, 3, 20, 0),
    fin: new Date(2026, 9, 3, 22, 0),
    lieuId: null,
    statut: 'en_cours',
    lanceParUid: uid,
    createdAt: serverTimestamp(),
    ...champs,
  })
  const recuperation = (uid: string) => ({
    statut: 'recupere',
    montantRecupere: 8000,
    recupereParUid: uid,
    recupereAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'commerces', 'co1'), { ...commerce(), createdAt: new Date(), updatedAt: new Date() })
      await setDoc(doc(db, 'blanchiments', 'b1'), { ...depot('n1'), createdAt: new Date() })
      await setDoc(doc(db, 'blanchiments', 'fini'), { ...depot('n1'), statut: 'recupere', createdAt: new Date() })
    })
  })

  it('tous les comptes validés consultent commerces et dépôts', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'commerces')))
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'blanchiments')))
    await assertFails(getDocs(collection(dbDe('attente'), 'commerces')))
  })
  it('seuls les gradés recensent les commerces', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'commerces', 'co2'), commerce()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'commerces', 'co2'), commerce({ proprietaireId: null, taux: null })))
    await assertFails(setDoc(doc(dbDe('n2'), 'commerces', 'co3'), commerce({ zip: '' })))
    await assertFails(setDoc(doc(dbDe('n2'), 'commerces', 'co4'), commerce({ taux: 150 })))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'commerces', 'co5'), commerce({ montantMax: 50000 })))
    await assertFails(setDoc(doc(dbDe('n2'), 'commerces', 'co6'), commerce({ montantMax: -1 })))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'commerces', 'co7'), commerce({ genre: 'express', securise: false })))
    await assertFails(setDoc(doc(dbDe('n2'), 'commerces', 'co8'), commerce({ genre: 'luxe' })))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'commerces', 'co1'), { taux: 75, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(dbDe('noir'), 'commerces', 'co1')))
  })
  it('seuls les gradés lancent un dépôt, en leur nom', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'blanchiments', 'b2'), depot('violet')))
    await assertFails(setDoc(doc(dbDe('n2'), 'blanchiments', 'b3'), depot('n1')))
    await assertFails(setDoc(doc(dbDe('n2'), 'blanchiments', 'b4'), depot('n2', { montant: 0 })))
    await assertFails(setDoc(doc(dbDe('n2'), 'blanchiments', 'b5'), depot('n2', { statut: 'recupere' })))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'blanchiments', 'b6'), depot('n2', { lieuId: 'qg' })))
  })
  it('récupération par un gradé, puis plus aucun changement', async () => {
    await assertFails(updateDoc(doc(dbDe('violet'), 'blanchiments', 'b1'), recuperation('violet')))
    await assertFails(updateDoc(doc(dbDe('n2'), 'blanchiments', 'b1'), { ...recuperation('n2'), montant: 1 }))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'blanchiments', 'b1'), recuperation('n2')))
    await assertFails(updateDoc(doc(dbDe('admin'), 'blanchiments', 'fini'), recuperation('admin')))
    await assertFails(deleteDoc(doc(dbDe('admin'), 'blanchiments', 'fini')))
  })
  it('un dépôt en cours s’annule (suppression) par un gradé uniquement', async () => {
    await assertFails(deleteDoc(doc(dbDe('violet'), 'blanchiments', 'b1')))
    await assertSucceeds(deleteDoc(doc(dbDe('n2'), 'blanchiments', 'b1')))
  })
})

describe('event', () => {
  const event = (db: ReturnType<typeof dbDe>, id = 'courant') => doc(db, 'events', id)
  const reglage = (modif: Record<string, unknown> = {}) => ({
    nom: 'Course au produit',
    points: { '12': 5 },
    updatedAt: serverTimestamp(),
    ...modif,
  })

  it('les gradés règlent l’event, tout membre validé le lit', async () => {
    await assertSucceeds(setDoc(event(dbDe('n2')), reglage()))
    await assertSucceeds(setDoc(event(dbDe('cache')), { points: { '13': 2 }, updatedAt: serverTimestamp() }, { merge: true }))
    await assertSucceeds(getDoc(event(dbDe('noir'))))
    await assertFails(getDoc(event(dbDe('attente'))))
    await assertFails(setDoc(event(dbDe('violet')), reglage()))
  })
  it('un seul document, bien formé, jamais supprimé', async () => {
    await assertFails(setDoc(event(dbDe('n1'), 'autre'), reglage()))
    await assertFails(setDoc(event(dbDe('n1')), reglage({ points: 'beaucoup' })))
    await assertFails(setDoc(event(dbDe('n1')), reglage({ score: 100 })))
    await assertFails(setDoc(event(dbDe('n1')), reglage({ updatedAt: new Date(2020, 0, 1) })))
    await setDoc(event(dbDe('n1')), reglage())
    await assertFails(deleteDoc(event(dbDe('admin'))))
  })
})

describe('amendes', () => {
  const amende = (par: string, modif: Record<string, unknown> = {}) => ({
    membreUid: 'noir',
    membreNom: 'Noir',
    delit: 'effraction',
    date: serverTimestamp(),
    note: '',
    creeParUid: par,
    createdAt: serverTimestamp(),
    ...modif,
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      // Amende de « noir », saisie par « violet »
      await setDoc(doc(ctx.firestore(), 'amendes', 'am1'), {
        ...amende('violet'),
        date: new Date(),
        createdAt: new Date(),
      })
    })
  })

  it('tout membre validé note une amende, pour lui ou pour un autre', async () => {
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'amendes', 'a'), amende('noir')))
    await assertSucceeds(setDoc(doc(dbDe('violet'), 'amendes', 'b'), amende('violet', { note: 'En fuite' })))
    await assertSucceeds(
      setDoc(doc(dbDe('violet'), 'amendes', 'c'), amende('violet', { date: new Date(Date.now() - 3_600_000) })),
    )
    await assertFails(setDoc(doc(dbDe('attente'), 'amendes', 'd'), amende('attente')))
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'amendes')))
    await assertFails(getDocs(collection(dbDe('attente'), 'amendes')))
  })
  it('amende signée, délit connu, sans montant, jamais dans le futur', async () => {
    const creer = (modif: Record<string, unknown>) =>
      setDoc(doc(dbDe('violet'), 'amendes', 'x'), amende('violet', modif))
    await assertFails(creer({ creeParUid: 'n1' }))
    await assertFails(creer({ delit: 'inconnu' }))
    await assertFails(creer({ montant: 1500 }))
    await assertFails(creer({ date: new Date(Date.now() + 3_600_000) }))
    await assertFails(creer({ recidive: true }))
  })
  it('note corrigée par l’auteur, le joueur concerné ou un gradé, et rien d’autre', async () => {
    for (const uid of ['violet', 'noir', 'n2', 'cache']) {
      await assertSucceeds(updateDoc(doc(dbDe(uid), 'amendes', 'am1'), { note: `ok ${uid}` }))
    }
    await assertFails(updateDoc(doc(dbDe('ancien'), 'amendes', 'am1'), { note: 'non' }))
    await assertFails(updateDoc(doc(dbDe('violet'), 'amendes', 'am1'), { montant: 1 }))
    await assertFails(updateDoc(doc(dbDe('violet'), 'amendes', 'am1'), { delit: 'dab' }))
    await assertFails(updateDoc(doc(dbDe('n1'), 'amendes', 'am1'), { membreUid: 'violet' }))
  })
  it('suppression : mêmes droits que la correction', async () => {
    await assertFails(deleteDoc(doc(dbDe('ancien'), 'amendes', 'am1')))
    await assertSucceeds(deleteDoc(doc(dbDe('noir'), 'amendes', 'am1')))
  })
})

describe('contrats', () => {
  const contrat = (champs: Record<string, unknown> = {}) => ({
    libelle: 'Philippe',
    montant: 50000,
    echeance: new Date(2026, 9, 9, 21, 0),
    heureFixee: true,
    paye: false,
    note: '',
    createdAt: serverTimestamp(),
    ...champs,
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contrats', 'ct1'), { ...contrat(), createdAt: new Date() })
    })
  })

  it('tous les comptes validés consultent', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'contrats')))
    await assertFails(getDocs(collection(dbDe('attente'), 'contrats')))
  })
  it('seuls les gradés créent, marquent payé, modifient et suppriment', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'contrats', 'ct2'), contrat()))
    await assertFails(updateDoc(doc(dbDe('violet'), 'contrats', 'ct1'), { paye: true }))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'contrats', 'ct2'), contrat({ libelle: 'Benny’s', heureFixee: false })))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'contrats', 'ct1'), { paye: true }))
    await assertFails(deleteDoc(doc(dbDe('noir'), 'contrats', 'ct1')))
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'contrats', 'ct1')))
  })
  it('données invalides refusées', async () => {
    await assertFails(setDoc(doc(dbDe('n2'), 'contrats', 'ct3'), contrat({ montant: -1 })))
    await assertFails(setDoc(doc(dbDe('n2'), 'contrats', 'ct4'), contrat({ libelle: '' })))
    await assertFails(setDoc(doc(dbDe('n2'), 'contrats', 'ct5'), contrat({ echeance: 'vendredi' })))
    await assertFails(setDoc(doc(dbDe('n2'), 'contrats', 'ct6'), contrat({ hebdo: 'oui' })))
  })
  it('un contrat peut être hebdomadaire, et son échéance avance une fois payée', async () => {
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'contrats', 'ct7'), contrat({ hebdo: true })))
    await assertSucceeds(
      updateDoc(doc(dbDe('n2'), 'contrats', 'ct7'), { paye: true, echeance: new Date(2026, 9, 16, 21, 0) }),
    )
  })
})

describe('annuaire', () => {
  const contact = (champs: Record<string, unknown> = {}) => ({
    nom: 'Marcus Reed',
    telephone: '5550142',
    role: 'Chef',
    partenaireId: null,
    informations: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...champs,
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contacts', 'k1'), {
        nom: 'Lena Cruz',
        telephone: '',
        role: '',
        partenaireId: 'p1',
        informations: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })
  })

  it('tous les comptes validés consultent', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'contacts')))
    await assertFails(getDocs(collection(dbDe('attente'), 'contacts')))
  })
  it('seuls les gradés ajoutent, modifient et suppriment', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'contacts', 'k2'), contact()))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'contacts', 'k2'), contact({ partenaireId: 'p1' })))
    await assertFails(updateDoc(doc(dbDe('noir'), 'contacts', 'k1'), { role: 'Patron', updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(dbDe('n1'), 'contacts', 'k1'), { partenaireId: null, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(dbDe('violet'), 'contacts', 'k1')))
    await assertSucceeds(deleteDoc(doc(dbDe('admin'), 'contacts', 'k1')))
  })
  it('un contact a toujours un nom', async () => {
    await assertFails(setDoc(doc(dbDe('n2'), 'contacts', 'k3'), contact({ nom: '' })))
  })
  it('un partenaire peut être une entreprise ou le Cartel, avec une couleur', async () => {
    const organisation = (type: string, couleur?: unknown) => ({
      nom: 'Benny’s',
      type,
      telephone: '',
      note: '',
      createdAt: serverTimestamp(),
      ...(couleur === undefined ? {} : { couleur }),
    })
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'partenaires', 'e1'), organisation('entreprise')))
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'partenaires', 'e2'), organisation('cartel', '#dc2626')))
    await assertFails(setDoc(doc(dbDe('n2'), 'partenaires', 'e3'), organisation('groupe', 'rouge')))
    // Une fiche créée avant les couleurs en reçoit une à la modification
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'partenaires', 'p1'), { couleur: '#16a34a' }))
  })
})

describe('commerce', () => {
  const ligne = { reference: '12', sens: 'vente', quantite: 100, prixPropre: 50, prixSale: null }
  const commande = (uid: string, statut = 'en_attente') => ({
    partenaireId: 'p1',
    partenaireNom: 'Vagos',
    sens: 'vente',
    statut,
    lignes: [ligne],
    creeParUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const cloture = (uid: string, statut: string) => ({
    statut,
    recuPropre: null,
    recuSale: 2500,
    recuItems: [{ reference: '40', quantite: 50 }],
    payePropre: null,
    payeSale: null,
    payeItems: [],
    lieuId: 'qg',
    note: '',
    clotureParUid: uid,
    clotureAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const base = { partenaireId: 'p1', partenaireNom: 'Vagos', sens: 'vente', lignes: [ligne], creeParUid: 'noir' }
      const dates = { createdAt: new Date(), updatedAt: new Date() }
      await setDoc(doc(ctx.firestore(), 'commandes', 'c1'), { ...base, ...dates, statut: 'en_attente' })
      await setDoc(doc(ctx.firestore(), 'commandes', 'close'), { ...base, ...dates, statut: 'validee' })
    })
  })

  it('tout membre validé consulte et crée une commande en attente, en son nom', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'commandes')))
    await assertFails(getDocs(collection(dbDe('attente'), 'commandes')))
    await assertSucceeds(setDoc(doc(dbDe('noir'), 'commandes', 'n1'), commande('noir')))
    await assertFails(setDoc(doc(dbDe('noir'), 'commandes', 'n2'), commande('violet')))
    await assertFails(setDoc(doc(dbDe('noir'), 'commandes', 'n3'), commande('noir', 'validee')))
    await assertFails(setDoc(doc(dbDe('noir'), 'commandes', 'n4'), { ...commande('noir'), lignes: [] }))
    await assertFails(setDoc(doc(dbDe('attente'), 'commandes', 'n5'), commande('attente')))
  })
  it('tout membre validé modifie les lignes d’une commande en attente, et rien d’autre', async () => {
    // Une même commande peut mêler une vente et un achat
    const lignes = [ligne, { reference: '13', sens: 'achat', quantite: 2, prixPropre: null, prixSale: 10 }]
    await assertSucceeds(updateDoc(doc(dbDe('violet'), 'commandes', 'c1'), { lignes, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(dbDe('violet'), 'commandes', 'c1'), { lignes: [], updatedAt: serverTimestamp() }))
    await assertFails(
      updateDoc(doc(dbDe('violet'), 'commandes', 'c1'), { partenaireNom: 'Autre', updatedAt: serverTimestamp() }),
    )
  })
  it('seul un gradé valide ou annule, en son nom', async () => {
    await assertFails(updateDoc(doc(dbDe('violet'), 'commandes', 'c1'), cloture('violet', 'validee')))
    await assertFails(updateDoc(doc(dbDe('n2'), 'commandes', 'c1'), cloture('n1', 'validee')))
    await assertFails(updateDoc(doc(dbDe('n2'), 'commandes', 'c1'), { ...cloture('n2', 'validee'), recuSale: -1 }))
    await assertFails(updateDoc(doc(dbDe('n2'), 'commandes', 'c1'), { ...cloture('n2', 'validee'), payeItems: 'rien' }))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'commandes', 'c1'), cloture('n2', 'validee')))
  })
  it('une commande close ne change plus et rien ne se supprime', async () => {
    await assertFails(updateDoc(doc(dbDe('admin'), 'commandes', 'close'), cloture('admin', 'annulee')))
    await assertFails(
      updateDoc(doc(dbDe('admin'), 'commandes', 'close'), { lignes: [ligne], updatedAt: serverTimestamp() }),
    )
    await assertFails(deleteDoc(doc(dbDe('admin'), 'commandes', 'c1')))
  })
})

describe('tâches', () => {
  const tache = (uid: string) => ({
    titre: 'Ravitailler le QG',
    ordre: 1,
    fait: false,
    auteurUid: uid,
    createdAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'taches', 't1'), {
        titre: 'Recruter',
        ordre: 1,
        fait: false,
        auteurUid: 'n1',
        createdAt: new Date(),
      })
    })
  })

  it('lecture par les comptes validés', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'taches')))
    await assertFails(getDocs(collection(dbDe('attente'), 'taches')))
  })
  it('les gradés créent, cochent, réordonnent et suppriment', async () => {
    await assertSucceeds(setDoc(doc(dbDe('n2'), 'taches', 't2'), tache('n2')))
    await assertSucceeds(updateDoc(doc(dbDe('n2'), 'taches', 't1'), { fait: true }))
    await assertSucceeds(updateDoc(doc(dbDe('admin'), 'taches', 't1'), { ordre: 5 }))
    await assertSucceeds(deleteDoc(doc(dbDe('n1'), 'taches', 't1')))
  })
  it('tout membre validé coche et décoche, sans rien changer d’autre', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('noir'), 'taches', 't1'), { fait: true }))
    await assertSucceeds(updateDoc(doc(dbDe('violet'), 'taches', 't1'), { fait: false }))
    await assertFails(updateDoc(doc(dbDe('noir'), 'taches', 't1'), { fait: true, titre: 'Autre' }))
    await assertFails(updateDoc(doc(dbDe('noir'), 'taches', 't1'), { ordre: 9 }))
    await assertFails(updateDoc(doc(dbDe('attente'), 'taches', 't1'), { fait: true }))
  })
  it('les Masques ne créent ni ne suppriment de tâche', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'taches', 't3'), tache('violet')))
    await assertFails(deleteDoc(doc(dbDe('noir'), 'taches', 't1')))
  })
  it('une tâche se crée en son propre nom, avec un titre', async () => {
    await assertFails(setDoc(doc(dbDe('n2'), 'taches', 't4'), tache('n1')))
    await assertFails(setDoc(doc(dbDe('n2'), 'taches', 't5'), { ...tache('n2'), titre: '' }))
    await assertFails(updateDoc(doc(dbDe('n2'), 'taches', 't1'), { fait: 'oui' }))
  })
})

describe('annonces', () => {
  const annonce = (uid: string) => ({
    titre: 'Titre',
    contenu: 'Texte',
    auteurUid: uid,
    auteurNom: uid,
    createdAt: serverTimestamp(),
  })

  it('lecture réservée aux comptes validés', async () => {
    await assertSucceeds(getDocs(collection(dbDe('noir'), 'annonces')))
    await assertFails(getDocs(collection(dbDe('attente'), 'annonces')))
  })
  it('publication à partir de Masque violet, en son propre nom', async () => {
    await assertSucceeds(setDoc(doc(dbDe('violet'), 'annonces', 'n1'), annonce('violet')))
    await assertFails(setDoc(doc(dbDe('noir'), 'annonces', 'n2'), annonce('noir')))
    await assertFails(setDoc(doc(dbDe('violet'), 'annonces', 'n3'), annonce('n1')))
  })
  it('suppression par l’auteur Masque violet ou par un gradé', async () => {
    await assertFails(deleteDoc(doc(dbDe('noir'), 'annonces', 'a1')))
    await assertSucceeds(deleteDoc(doc(dbDe('violet'), 'annonces', 'a1')))
  })
  it('un N2 supprime l’annonce d’un autre', async () => {
    await assertSucceeds(deleteDoc(doc(dbDe('n2'), 'annonces', 'a1')))
  })
})

describe('logs', () => {
  const log = (uid: string) => ({
    action: 'validation',
    acteurUid: uid,
    acteurNom: uid,
    cibleUid: 'attente',
    cibleNom: 'attente',
    ancienRole: 'pending',
    nouveauRole: 'membre',
    createdAt: serverTimestamp(),
  })

  it('lecture et écriture réservées à N2, N1 et admin', async () => {
    for (const uid of ['admin', 'n1', 'n2']) {
      await assertSucceeds(getDocs(collection(dbDe(uid), 'logs')))
      await assertSucceeds(setDoc(doc(dbDe(uid), 'logs', `nouveau-${uid}`), log(uid)))
    }
    await assertFails(getDocs(collection(dbDe('violet'), 'logs')))
    await assertFails(setDoc(doc(dbDe('violet'), 'logs', 'x'), log('violet')))
  })
  it('journal non modifiable, même par un admin', async () => {
    await assertFails(updateDoc(doc(dbDe('admin'), 'logs', 'l1'), { action: 'autre' }))
    await assertFails(deleteDoc(doc(dbDe('admin'), 'logs', 'l1')))
  })
})
