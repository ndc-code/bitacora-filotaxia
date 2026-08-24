import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANTAS_PATH = path.join(__dirname, '..', 'index.html');

/**
 * Catálogo de Filotaxia: Haworthias (suculentas de colección), plantas para
 * terrarios abiertos y cerrados, musgos y colémbolos (cultivos de limpieza
 * bioactivos). Los campos se reutilizan del catálogo de jardinería original:
 * "Luz" en la escala Alta/Media/Baja, "Suelo" aproximado al sustrato real más
 * cercano dentro del vocabulario existente (Arenoso = mezcla mineral de
 * drenaje rápido, Franco = sustrato orgánico general, Arcilloso = sustrato
 * que retiene mucha humedad, como sphagnum o turba compactada), "Riego" como
 * frecuencia de riego o nebulización según el ítem, y "Clima" la franja
 * térmica que tolera. El campo "Sol" se deriva de la luz.
 */
const CATEGORIES = [
  {
    label: 'Suculentas',
    plants: [
      ['Haworthia cebra', 'Haworthia attenuata', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Haworthia rayada', 'Haworthia fasciata', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Haworthia cooperi', 'Haworthia cooperi', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Cálido'],
      ['Haworthia ventana', 'Haworthia cymbiformis', 'Media', 'Arenoso', 'Fácil', 'Cada 14 días', 'Templado'],
      ['Haworthia retusa', 'Haworthia retusa', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Templado'],
      ['Haworthia trunca', 'Haworthia truncata', 'Alta', 'Arenoso', 'Exigente', 'Cada 21 días', 'Cálido'],
      ['Haworthia limifolia', 'Haworthia limifolia', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Haworthia perla', 'Haworthia pumila', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Haworthia reinwardtii', 'Haworthia reinwardtii', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Haworthia venosa', 'Haworthia venosa', 'Media', 'Arenoso', 'Medio', 'Cada 14 días', 'Cálido'],
      ['Haworthia bolusii', 'Haworthia bolusii', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Templado'],
      ['Haworthia emelyae', 'Haworthia emelyae', 'Alta', 'Arenoso', 'Exigente', 'Cada 21 días', 'Cálido'],
      ['Haworthia mirabilis', 'Haworthia mirabilis', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Templado'],
      ['Haworthia maughanii', 'Haworthia maughanii', 'Alta', 'Arenoso', 'Exigente', 'Cada 21 días', 'Cálido'],
      ['Haworthia pictada', 'Haworthia picta', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Templado'],
      ['Haworthia magnífica', 'Haworthia magnifica', 'Media', 'Arenoso', 'Medio', 'Cada 21 días', 'Templado'],
    ],
  },
  {
    label: 'Terrarios Abiertos',
    plants: [
      ['Echeveria', 'Echeveria elegans', 'Alta', 'Arenoso', 'Fácil', 'Cada 14 días', 'Templado'],
      ['Sedum burrito', 'Sedum burrito', 'Alta', 'Arenoso', 'Fácil', 'Cada 14 días', 'Templado'],
      ['Crasula ovata', 'Crassula ovata', 'Alta', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Siempreviva', 'Sempervivum tectorum', 'Alta', 'Arenoso', 'Fácil', 'Cada 21 días', 'Frío'],
      ['Elefantito', 'Portulacaria afra', 'Alta', 'Arenoso', 'Fácil', 'Cada 14 días', 'Cálido'],
      ['Rosario de bebé', 'Senecio rowleyanus', 'Media', 'Arenoso', 'Medio', 'Cada 14 días', 'Templado'],
      ['Gasteria', 'Gasteria bicolor', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Clavel del aire', 'Tillandsia ionantha', 'Alta', 'Arenoso', 'Fácil', 'Cada 7 días', 'Cálido'],
      ['Aloe mini', "Aloe vera 'Minibelle'", 'Alta', 'Arenoso', 'Fácil', 'Cada 21 días', 'Cálido'],
      ['Kalanchoe', 'Kalanchoe tomentosa', 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Templado'],
      ['Lithops', 'Lithops sp.', 'Alta', 'Arenoso', 'Exigente', 'Cada 30 días', 'Cálido'],
      ['Sansevieria mini', "Sansevieria trifasciata 'Hahnii'", 'Media', 'Arenoso', 'Fácil', 'Cada 21 días', 'Cálido'],
    ],
  },
  {
    label: 'Terrarios Cerrados',
    plants: [
      ['Fitonia', 'Fittonia albivenis', 'Baja', 'Franco', 'Medio', 'Cada 5 días', 'Cálido'],
      ['Pilea', 'Pilea depressa', 'Media', 'Franco', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Peperomia sandía', 'Peperomia caperata', 'Media', 'Franco', 'Fácil', 'Cada 7 días', 'Cálido'],
      ['Selaginela', 'Selaginella kraussiana', 'Baja', 'Franco', 'Medio', 'Cada 5 días', 'Cálido'],
      ['Ficus enano', "Ficus pumila 'Quercifolia'", 'Media', 'Franco', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Singonio mini', "Syngonium podophyllum 'Pixie'", 'Media', 'Franco', 'Fácil', 'Cada 7 días', 'Cálido'],
      ['Cryptanthus', 'Cryptanthus bivittatus', 'Baja', 'Franco', 'Medio', 'Cada 10 días', 'Cálido'],
      ['Lágrimas de bebé', 'Soleirolia soleirolii', 'Baja', 'Franco', 'Fácil', 'Cada 5 días', 'Templado'],
      ['Culantrillo enano', "Adiantum raddianum 'Fragrantissimum'", 'Baja', 'Franco', 'Exigente', 'Cada 5 días', 'Templado'],
      ['Begonia mini', 'Begonia bowerae', 'Baja', 'Franco', 'Medio', 'Cada 7 días', 'Cálido'],
      ['Marcgravia', 'Marcgravia sp.', 'Baja', 'Franco', 'Exigente', 'Cada 7 días', 'Cálido'],
      ['Peperomia trepadora', 'Peperomia prostrata', 'Media', 'Franco', 'Fácil', 'Cada 7 días', 'Cálido'],
    ],
  },
  {
    label: 'Musgo',
    plants: [
      ['Musgo de Java', 'Taxiphyllum barbieri', 'Baja', 'Franco', 'Fácil', 'Cada 5 días', 'Cálido'],
      ['Musgo Sphagnum', 'Sphagnum sp.', 'Baja', 'Arcilloso', 'Fácil', 'Cada 5 días', 'Templado'],
      ['Musgo Frizzy', "Vesicularia sp. 'Frizzy'", 'Baja', 'Franco', 'Fácil', 'Cada 5 días', 'Cálido'],
      ['Musgo almohadilla', 'Leucobryum glaucum', 'Baja', 'Arcilloso', 'Medio', 'Cada 7 días', 'Templado'],
      ['Musgo de roca', 'Hypnum curvifolium', 'Baja', 'Franco', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Musgo Fissidens', 'Fissidens fontanus', 'Baja', 'Franco', 'Medio', 'Cada 5 días', 'Cálido'],
      ['Musgo estrella', 'Tortula sp.', 'Media', 'Arcilloso', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Musgo cristata', "Vesicularia montagnei 'Christmas'", 'Baja', 'Franco', 'Medio', 'Cada 5 días', 'Cálido'],
    ],
  },
  {
    label: 'Colémbolos',
    plants: [
      ['Colémbolo blanco', 'Folsomia candida', 'Baja', 'Franco', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Colémbolo rosa', 'Sinella curviseta', 'Baja', 'Franco', 'Fácil', 'Cada 7 días', 'Templado'],
      ['Colémbolo tropical', 'Seira sp.', 'Media', 'Franco', 'Medio', 'Cada 7 días', 'Cálido'],
      ['Colémbolo globular', 'Dicyrtomina minuta', 'Media', 'Franco', 'Medio', 'Cada 7 días', 'Templado'],
      ['Colémbolo de nieve', 'Ceratophysella sp.', 'Baja', 'Franco', 'Fácil', 'Cada 10 días', 'Frío'],
      ['Colémbolo de jardín', 'Entomobrya sp.', 'Media', 'Franco', 'Fácil', 'Cada 10 días', 'Templado'],
    ],
  },
];

const RIEGOS = ['Cada 5 días', 'Cada 7 días', 'Cada 10 días', 'Cada 14 días', 'Cada 21 días', 'Cada 30 días'];

/** Placeholder confiable (siempre carga), distinto por planta según su slug */
function imagenParaSlug(slug) {
  return `https://picsum.photos/seed/${slug}/1400/1400`;
}

function riegosEstacionales(riegoBase) {
  const idx = RIEGOS.indexOf(riegoBase);
  const clamp = (i) => RIEGOS[Math.max(0, Math.min(RIEGOS.length - 1, i))];
  return {
    verano: clamp(idx - 1),
    primavera: riegoBase,
    otoño: riegoBase,
    invierno: clamp(idx + 1),
  };
}

function solParaLuz(luz) {
  if (luz === 'Alta' || luz === 'Directa') return 'Sol';
  if (luz === 'Baja' || luz === 'Sombra') return 'Sombra';
  return 'Media sombra';
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function buildRow([name, species, luz, suelo, cuidado, riegoBase, clima, overrides], categoria) {
  const riegos = riegosEstacionales(riegoBase);
  const sol = solParaLuz(luz);
  const slug = slugify(`${name}-${species}`);
  const imagen = overrides?.imagen ?? imagenParaSlug(slug);
  const id = overrides?.id ?? `${name}::${species}::${slug}`.toLowerCase();

  return {
    name,
    species,
    luz,
    suelo,
    cuidado,
    riego: riegoBase,
    riegos,
    clima,
    sol,
    categoria,
    imagen,
    id,
  };
}

function rowHtml(row) {
  const riegosAttr = escapeAttr(JSON.stringify(row.riegos));
  const addAttrs = `data-id="${escapeAttr(row.id)}" data-nombre="${escapeAttr(row.name)}" data-especie="${escapeAttr(row.species)}" data-riego="${escapeAttr(row.riego)}" data-riegos="${riegosAttr}" data-clima="${escapeAttr(row.clima)}" data-luz="${escapeAttr(row.luz)}" data-ubicacion="${escapeAttr(row.sol)}" data-suelo="${escapeAttr(row.suelo)}" data-cuidado="${escapeAttr(row.cuidado)}" data-imagen="${escapeAttr(row.imagen)}" data-galeria="${escapeAttr(JSON.stringify([row.imagen]))}"`;

  return `<div class="catalog-entry" data-riego="${escapeAttr(row.riego)}" data-riegos="${riegosAttr}" data-clima="${escapeAttr(row.clima)}" data-luz="${escapeAttr(row.luz)}" data-ubicacion="${escapeAttr(row.sol)}" data-suelo="${escapeAttr(row.suelo)}" data-cuidado="${escapeAttr(row.cuidado)}">
  <figure class="catalog-tile">
    <div class="catalog-tile-head">
      <figcaption class="catalog-tile-name">${escapeAttr(row.name)}</figcaption>
      <button type="button" class="catalog-add catalog-add--tile" ${addAttrs} title="Agregar a Colección" aria-label="Agregar a Colección">(+)</button>
    </div>
    <div class="catalog-tile-media">
      <img src="${escapeAttr(row.imagen)}" alt="${escapeAttr(row.name)}" loading="lazy" width="300" height="300" />
    </div>
  </figure>
  <article class="catalog-spotlight">
    <div class="catalog-spotlight-side">
      <div class="catalog-spotlight-top">
        <span class="catalog-spotlight-name">${escapeAttr(row.name)}</span>
        <button type="button" class="catalog-add catalog-add--spotlight" ${addAttrs} title="Agregar a Colección" aria-label="Agregar a Colección">(+)</button>
      </div>
      <p class="catalog-spotlight-bottom">${escapeAttr(row.species)} · ${escapeAttr(row.sol)}</p>
    </div>
    <figure class="catalog-spotlight-media">
      <img src="${escapeAttr(row.imagen)}" alt="${escapeAttr(row.name)}" loading="lazy" width="480" height="640" />
    </figure>
  </article>
  <div class="catalog-row" role="button" tabindex="0" aria-expanded="false">
    <span>${row.name}</span>
    <span>${row.species}</span>
    <span>${row.sol}</span>
    <span>${row.luz}</span>
    <span class="catalog-riego">${row.riego}</span>
    <span>${row.clima}</span>
    <span>${row.suelo}</span>
    <span>${row.cuidado}</span>
    <span class="catalog-cell--action"><button type="button" class="catalog-add" ${addAttrs} title="Agregar a Colección" aria-label="Agregar a Colección">(Agregar)</button></span>
  </div>
  <div class="catalog-accordion">
    <div class="catalog-accordion-inner">
      <dl class="catalog-detail">
        <div class="catalog-detail-row"><dt>Especie</dt><dd>${escapeAttr(row.species)}</dd></div>
        <div class="catalog-detail-row"><dt>Sol</dt><dd>${escapeAttr(row.sol)}</dd></div>
        <div class="catalog-detail-row"><dt>Luminosidad</dt><dd>${escapeAttr(row.luz)}</dd></div>
        <div class="catalog-detail-row"><dt>Riego</dt><dd class="catalog-riego">${escapeAttr(row.riego)}</dd></div>
        <div class="catalog-detail-row"><dt>Clima</dt><dd>${escapeAttr(row.clima)}</dd></div>
        <div class="catalog-detail-row"><dt>Suelo</dt><dd>${escapeAttr(row.suelo)}</dd></div>
        <div class="catalog-detail-row"><dt>Cuidado</dt><dd>${escapeAttr(row.cuidado)}</dd></div>
      </dl>
      <div class="catalog-gallery">
      <figure class="catalog-gallery-item">
        <img src="${escapeAttr(row.imagen)}" alt="${escapeAttr(row.name)} 1/1" loading="lazy" width="200" height="150" />
        <figcaption>1/1</figcaption>
      </figure>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Cada categoría abre con su nombre, la línea, y su propia fila de títulos de
 * columna. El toggle de estación se repite con ella, por eso usa clases y no
 * `id`: con siete categorías, un `id` quedaría duplicado siete veces.
 */
function headerHtml() {
  return `<div class="catalog-row is-header" role="row">
  <span>Nombre</span>
  <span>Especie</span>
  <span>Sol</span>
  <span>Luminosidad</span>
  <button type="button" class="catalog-riego-toggle" data-estacion="verano" aria-label="Riego en verano. Clic para cambiar estación">
    Riego <span class="riego-estacion-label">(verano)</span>
  </button>
  <span>Clima</span>
  <span>Suelo</span>
  <span>Cuidado</span>
  <span class="catalog-cell--action">Colección</span>
</div>`;
}

function categoryHtml(label, cantidad) {
  return `<div class="catalog-category" role="row"><span class="catalog-category-label">${escapeAttr(label)}</span><span class="catalog-category-count">(${cantidad})</span></div>`;
}

const START_MARKER = '<!-- catalog-rows:start -->';
const END_MARKER = '<!-- catalog-rows:end -->';
const CATEGORIAS_PATH = path.join(__dirname, '..', 'js/utils/catalog-categorias-data.js');

const collator = new Intl.Collator('es', { sensitivity: 'base' });

function main() {
  const blocks = [];

  // Cada categoría se envuelve en su propio elemento para que el atenuado por
  // hover quede acotado a ella: `.catalog-group:hover` no puede alcanzar a las
  // plantas de las otras categorías. Con el DOM plano no había forma de
  // expresarlo en CSS, porque no existe un selector de "hermanos hasta el
  // próximo encabezado".
  for (const { label, plants } of CATEGORIES) {
    const sorted = [...plants].sort((a, b) => collator.compare(a[0], b[0]));
    blocks.push({ categoryHeader: label, rows: sorted.map((p) => buildRow(p, label)) });
  }

  // El título de la categoría queda FUERA de `.catalog-group-table`: el atenuado
  // por hover se dispara con la tabla, no con el título, que es enorme y ocupa
  // media pantalla.
  const html = blocks
    .map(
      (b) => `<section class="catalog-group">
${categoryHtml(b.categoryHeader, b.rows.length)}
<div class="catalog-group-table">
${headerHtml()}
${b.rows.map(rowHtml).join('\n')}
</div>
</section>`
    )
    .join('\n');

  const plantas = fs.readFileSync(PLANTAS_PATH, 'utf8');
  const startIdx = plantas.indexOf(START_MARKER);
  const endIdx = plantas.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error('No se encontraron marcadores catalog-rows en index.html');
    process.exit(1);
  }

  const before = plantas.slice(0, startIdx + START_MARKER.length);
  const after = plantas.slice(endIdx);
  const replaced = `${before}\n${html}\n${after}`;

  fs.writeFileSync(PLANTAS_PATH, replaced, 'utf8');

  const totalRows = blocks.reduce((n, b) => n + b.rows.length, 0);
  console.log(`Generadas ${totalRows} filas en ${CATEGORIES.length} categorías, ordenadas alfabéticamente.`);
  writeCategoriasModule();
}

function writeCategoriasModule() {
  const map = {};
  for (const { label, plants } of CATEGORIES) {
    for (const plant of plants) {
      const row = buildRow(plant, label);
      map[`${row.name}::${row.species}`] = label;
      map[row.id] = label;
    }
  }
  const body = `export const CATEGORIA_POR_CLAVE = ${JSON.stringify(map, null, 2)};\n`;
  fs.writeFileSync(CATEGORIAS_PATH, body, 'utf8');
  console.log(`Índice de categorías escrito en ${path.relative(path.join(__dirname, '..'), CATEGORIAS_PATH)}.`);
}

if (process.argv.includes('--categorias-only')) {
  writeCategoriasModule();
} else {
  main();
}
