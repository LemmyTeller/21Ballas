// La journée de jeu ne bascule pas à minuit : elle commence à 3 h du matin, heure de Paris.
const HEURE_DE_BASCULE = 3

const jourParis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })

// Jour de saisie d'un instant, au format AAAA-MM-JJ : avant 3 h, on est encore dans la journée de la veille
export function jourDeSaisie(instant: number): string {
  return jourParis.format(new Date(instant - HEURE_DE_BASCULE * 3_600_000))
}

// « vendredi 9 octobre » à partir d'un jour AAAA-MM-JJ
export function formatJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
