// Le séparateur de milliers français par défaut (espace fine insécable) se voit à peine :
// on le remplace par une espace insécable de largeur normale.
const ESPACE_FINE = String.fromCharCode(0x202f)
export const ESPACE_INSECABLE = String.fromCharCode(0xa0)

function formateur(decimales: number) {
  const intl = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales })
  return (valeur: number) => intl.format(valeur).replaceAll(ESPACE_FINE, ESPACE_INSECABLE)
}

// 792 442
export const formatNombre = formateur(0)

const kilos = formateur(1)
// 158,5 kg
export const formatPoids = (kg: number) => `${kilos(kg)}${ESPACE_INSECABLE}kg`

const dollars = formateur(2)
// 1 250 $ ; « — » quand le prix n'est pas renseigné
export const formatPrix = (prix: number | null | undefined) =>
  prix === null || prix === undefined ? '—' : `${dollars(prix)}${ESPACE_INSECABLE}$`
