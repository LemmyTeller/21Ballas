import { ROLE_LABELS, estValide, nomAffiche, rang } from '../../lib/roles'
import type { Membre } from '../../types'

// L'effectif en texte, une ligne par membre validé, du plus gradé au moins gradé : « Nom - N1 - 1234 ».
// Le grade n'est indiqué que pour N1 et N2, et le préfixe 555- du numéro est retiré.
export function listeMembresTexte(membres: Membre[]): string {
  return membres
    .filter((m) => estValide(m.role))
    .sort((a, b) => rang(b.role) - rang(a.role) || nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))
    .map((m) => {
      const grade = m.role === 'n1' || m.role === 'n2' ? ROLE_LABELS[m.role] : ''
      const telephone = m.telephoneRP.trim().replace(/^555[-\s]+/, '')
      return [nomAffiche(m), grade, telephone].filter(Boolean).join(' - ')
    })
    .join('\n')
}
