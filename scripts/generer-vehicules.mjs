// Génère src/data/vehicules.json : le catalogue des véhicules de GTA V, pour retrouver la photo d'un modèle.
// Source : l'export communautaire DurtyFree/gta-v-data-dumps (noms de spawn, noms affichés, marques, catégories).
// Seuls quatre champs sont conservés. Trains et remorques sont écartés.
// Usage : npm run vehicules (nécessite un accès à Internet ; le fichier généré est versionné).
import { mkdirSync, writeFileSync } from 'node:fs'

const SOURCE = 'https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/vehicles.json'
const TYPES_ECARTES = ['TRAIN', 'TRAILER']

const reponse = await fetch(SOURCE)
if (!reponse.ok) throw new Error(`Téléchargement impossible : ${reponse.status} ${reponse.statusText}`)
const source = await reponse.json()

const libelle = (texte) => texte?.French || texte?.English || ''

const vehicules = source
  .filter((v) => !TYPES_ECARTES.includes(v.Type))
  .map((v) => ({
    spawn: v.Name.toLowerCase(),
    // Certains véhicules n'ont pas de nom affiché : on retombe sur le nom de spawn
    nom: libelle(v.DisplayName) || v.Name,
    marque: libelle(v.ManufacturerDisplayName),
    classe: v.Class,
  }))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.spawn.localeCompare(b.spawn))

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/vehicules.json', `${JSON.stringify(vehicules)}\n`)
console.log(`${vehicules.length} véhicules écrits dans src/data/vehicules.json`)
