# Generador de paraules (bigrames)

Petit prototipus d'un generador de text tipus LLM, basat en bigrames. Entrena amb un corpus, visualitza les transicions i genera text amb temperatura, pas a pas o animat.

## Funcionalitats
- Entrenament de bigrames a partir d'un corpus.
- Vista de bigrames ordenada per probabilitat, amb destacats segons el context actual.
- Generacio amb temperatura, pas a pas, instantani o animat.
- Panell d'alternatives (top 5) amb barres de probabilitat.

## Scripts
- `npm install`
- `npm run dev`
- `npm run build`

## Notes
- La normalitzacio passa a minuscules i tokenitza paraules i signes de puntuacio.
- Si una paraula no es al vocabulari, es busca la mes similar amb distància de Levenshtein.
