// Découpe la carte du serveur (map_gta5_21jc.png, à la racine, non versionnée) en tuiles WebP pour l'onglet Map.
// La carte entière est trop lourde pour le navigateur : il ne charge que les tuiles visibles, au niveau de zoom voulu.
// Sortie : public/carte/{zoom}/{x}/{y}.webp (non versionné) et src/data/carte.json (dimensions, versionné).
// Usage : npm run carte — à relancer quand la carte change, et avant un build sur une machine neuve.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'map_gta5_21jc.png'
const SORTIE = 'public/carte'
const TUILE = 512
// Bord des tuiles incomplètes : le fond de l'appli (zinc-950)
const FOND = { r: 9, g: 9, b: 11, alpha: 1 }

const { width: largeur, height: hauteur } = await sharp(SOURCE).metadata()
// Niveau le plus fin : la carte à sa résolution d'origine. Chaque niveau au-dessous la divise par deux,
// jusqu'à tenir dans une ou deux tuiles.
const zoomMax = Math.ceil(Math.log2(Math.max(largeur, hauteur) / TUILE)) - 1

rmSync(SORTIE, { recursive: true, force: true })
let total = 0

for (let zoom = 0; zoom <= zoomMax; zoom++) {
  const echelle = 2 ** (zoom - zoomMax)
  const l = Math.round(largeur * echelle)
  const h = Math.round(hauteur * echelle)
  const niveau = await sharp(SOURCE).resize(l, h).raw().toBuffer({ resolveWithObject: true })
  const image = () => sharp(niveau.data, { raw: niveau.info })

  for (let x = 0; x * TUILE < l; x++) {
    mkdirSync(`${SORTIE}/${zoom}/${x}`, { recursive: true })
    for (let y = 0; y * TUILE < h; y++) {
      const largeurTuile = Math.min(TUILE, l - x * TUILE)
      const hauteurTuile = Math.min(TUILE, h - y * TUILE)
      await image()
        .extract({ left: x * TUILE, top: y * TUILE, width: largeurTuile, height: hauteurTuile })
        // Toutes les tuiles font la même taille : celles du bord sont complétées
        .extend({ right: TUILE - largeurTuile, bottom: TUILE - hauteurTuile, background: FOND })
        .webp({ quality: 82 })
        .toFile(`${SORTIE}/${zoom}/${x}/${y}.webp`)
      total++
    }
  }
  console.log(`Zoom ${zoom} : ${l} × ${h}`)
}

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/carte.json', `${JSON.stringify({ largeur, hauteur, zoomMax, tuile: TUILE })}\n`)
console.log(`${total} tuiles écrites dans ${SORTIE}`)
