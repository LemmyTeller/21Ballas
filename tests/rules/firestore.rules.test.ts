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
    await assertSucceeds(changer('admin', 'noir', 'admin'))
    await assertSucceeds(changer('admin', 'n1', 'n2'))
    await assertSucceeds(changer('admin', 'admin2', 'revoque'))
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
  it('seuls les gradés modifient catégories et articles', async () => {
    await assertFails(setDoc(doc(dbDe('violet'), 'categoriesStock', 'c2'), categorie()))
    await assertFails(setDoc(doc(dbDe('violet'), 'articles', '13'), article()))
    await assertFails(updateDoc(doc(dbDe('violet'), 'articles', '12'), { 'quantites.qg': 99, updatedAt: serverTimestamp() }))
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
