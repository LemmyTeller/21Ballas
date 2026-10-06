import { signOut } from 'firebase/auth'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AuthProvider } from './auth/AuthProvider'
import { RequireRole } from './auth/RequireRole'
import { Button, CenteredScreen, Chargement, ErrorMessage, Logo } from './components/ui'
import { MigrationAdmin } from './features/members/MigrationAdmin'
import { AppLayout } from './layout/AppLayout'
import { auth } from './lib/firebase'
import { Accueil } from './pages/Accueil'
import { Amendes } from './pages/Amendes'
import { Annuaire } from './pages/Annuaire'
import { Blanchiment } from './pages/Blanchiment'
import { Carjacking } from './pages/Carjacking'
import { Commerce } from './pages/Commerce'
import { Event } from './pages/Event'
import { Gestion } from './pages/Gestion'
import { Inventaire } from './pages/Inventaire'
import { Journal } from './pages/Journal'
import { Login } from './pages/Login'
import { Membres } from './pages/Membres'
import { Pending, Revoque } from './pages/Pending'
import { Profil } from './pages/Profil'
import { Stock } from './pages/Stock'
import { Tarifs } from './pages/Tarifs'

function Portail() {
  const { user, membre, loading, error } = useAuth()

  if (loading) return <Chargement pleinEcran />
  if (!user) return <Login />
  if (!membre) {
    return (
      <CenteredScreen>
        <Logo />
        <ErrorMessage>{error ?? 'Fiche membre introuvable.'}</ErrorMessage>
        <Button variant="ghost" onClick={() => signOut(auth)}>
          Se déconnecter
        </Button>
      </CenteredScreen>
    )
  }
  if (membre.role === 'pending') return <Pending membre={membre} email={user.email} />
  if (membre.role === 'revoque') return <Revoque membre={membre} email={user.email} />
  // Ancien grade « Admin » : le compte choisit une fois son grade RP et reçoit le droit admin à la place
  if (membre.role === 'admin') return <MigrationAdmin membre={membre} />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Accueil />} />
          <Route path="membres" element={<Membres />} />
          <Route path="gestion" element={<Gestion />} />
          <Route path="stock" element={<Stock />} />
          <Route path="tarifs" element={<Tarifs />} />
          <Route path="transactions" element={<Commerce />} />
          {/* Ancienne adresse de l'onglet, du temps où il s'appelait Commerce */}
          <Route path="commerce" element={<Navigate to="/transactions" replace />} />
          <Route path="annuaire" element={<Annuaire />} />
          <Route path="blanchiment" element={<Blanchiment />} />
          <Route path="carjacking" element={<Carjacking />} />
          <Route path="amendes" element={<Amendes />} />
          <Route path="event" element={<Event />} />
          <Route path="profil" element={<Profil />} />
          <Route
            path="inventaire"
            element={
              <RequireRole minimum="n2">
                <Inventaire />
              </RequireRole>
            }
          />
          <Route
            path="journal"
            element={
              <RequireRole minimum="n2">
                <Journal />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Portail />
    </AuthProvider>
  )
}
