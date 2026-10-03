// Génère les catalogues de l'appli à partir des exports du serveur :
//   21_inventaire_items.json -> src/data/items.json
//   21_weapons_list.json     -> src/data/armes.json
// Seuls les champs affichés sont conservés : le reste des exports (prix, scripts, composants…) n'est jamais publié.
// Usage : npm run items
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

function generer(source, cible, reduire) {
  const lignes = JSON.parse(readFileSync(source, 'utf8')).map(reduire)
  writeFileSync(cible, `${JSON.stringify(lignes)}\n`)
  console.log(`${lignes.length} lignes écrites dans ${cible}`)
}

mkdirSync('src/data', { recursive: true })

generer('21_inventaire_items.json', 'src/data/items.json', ({ id, name, image, weight }) => ({
  id,
  name,
  image: image || null,
  weight,
}))

generer('21_weapons_list.json', 'src/data/armes.json', ({ id, name, category, image, weight }) => ({
  id,
  name,
  category,
  image: image || null,
  weight,
}))
