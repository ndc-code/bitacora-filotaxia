import { qs, qsa, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarColeccion, onColeccionChange } from '../services/coleccion.js';
import { listarTerrarios } from '../services/terrarios.js';
import { obtenerFotoPortada, subirPortadaTerrario, eliminarFotoTerrario } from '../services/terrario-fotos.js';
import { obtenerUrlFoto } from '../services/coleccion-fotos.js';
import { formatFechaCorta } from '../utils/riego-frecuencia.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { wireSeasonTheme } from '../utils/catalog-season-theme.js';
import { iniciarPagina, mostrarErrorDePagina } from '../utils/guard.js';
import { wireSidebarAccordion } from '../utils/catalog-sidebar-accordion.js';

const TIPO_TITULO = { abierto: 'Abiertos', cerrado: 'Cerrados' };
const TIPO_TITULO_SPLIT = { abierto: 'Terrarios Abiertos', cerrado: 'Terrarios Cerrados' };

const TIPO_INFO = {
  abierto: {
    descripcion: [
      'Terrarios sin tapa, pensados para plantas que necesitan aire circulando y no toleran la humedad estancada. Como no hay drenaje hacia afuera ni recirculación cerrada del agua, hay que regar con cuidado y esperar a que las plantas absorban toda el agua antes de volver a regar — se riega cada bastante tiempo, no por calendario fijo. Este es el formato para cactus y suculentas, que necesitan que el sustrato se seque bien entre riego y riego.',
    ],
    armado: [
      { capa: 'Capa 4: Grava decorativa', detalle: '300 ml' },
      {
        capa: 'Capa 3: Sustrato',
        detalle: '700 ml tierra cactus + 200 ml arena gruesa + 200 ml perlita + 100 ml piedra pómez chica',
      },
      { capa: 'Capa 2: Rejilla separadora', detalle: '1 unidad, metálica' },
      { capa: 'Capa 1: Base drenante', detalle: '1,5 L piedra pómez + 1 cdta carbón activado' },
    ],
    cuidados: [
      'Riego moderado: dejá secar el sustrato entre riego y riego.',
      'Luz indirecta intensa, varias horas por día.',
      'Sustrato de drenaje rápido (arenoso), nunca encharcado.',
      'Buena ventilación — evitá ubicarlo en un rincón sin aire.',
    ],
    plantas: [
      'Haworthia cebra', 'Haworthia rayada', 'Haworthia cooperi', 'Haworthia ventana',
      'Haworthia retusa', 'Haworthia trunca', 'Haworthia limifolia', 'Haworthia perla',
      'Haworthia reinwardtii', 'Haworthia venosa', 'Haworthia bolusii', 'Haworthia emelyae',
      'Haworthia mirabilis', 'Haworthia maughanii', 'Haworthia pictada', 'Haworthia magnífica',
      'Echeveria', 'Sedum burrito', 'Crasula ovata', 'Siempreviva', 'Elefantito',
      'Rosario de bebé', 'Gasteria', 'Clavel del aire', 'Aloe mini', 'Kalanchoe', 'Lithops',
      'Sansevieria mini', 'Echinocactus grusonii', 'Mammillaria', 'Opuntia microdasys',
      'Aeonium arboreum', 'Graptopetalum', 'Pachyphytum', 'Sedeveria', 'Senecio serpens',
      'Crassula perforata', 'Euphorbia obesa', 'Faucaria tigrina', 'Conophytum',
      'Pleiospilos nelii', 'Titanopsis', 'Cotyledon orbiculata', 'Adromischus', 'Delosperma',
      'Aptenia cordifolia', 'Portulacaria afra variegata', 'Aloe brevifolia',
      'Sempervivum arachnoideum', 'Senecio radicans',
    ],
    plantasTop: [
      'Aloe mini', 'Haworthia cebra', 'Echeveria', 'Sedum burrito', 'Crasula ovata',
      'Lithops', 'Sansevieria mini', 'Gasteria', 'Kalanchoe', 'Clavel del aire',
    ],
  },
  cerrado: {
    descripcion: [
      'Terrarios con tapa: funcionan como un ecosistema autosostenido donde el agua se condensa y vuelve a caer, casi sin riego externo.',
    ],
    cuidados: [
      'Riego esporádico: el agua se recicla adentro, regá solo si ves el sustrato seco.',
      'Luz indirecta suave — la luz directa sobrecalienta el ambiente cerrado.',
      'Ventilá cada tanto si aparece condensación excesiva o moho.',
      'Sustrato que retenga humedad (franco, con turba o musgo).',
    ],
    plantas: [
      'Fitonia', 'Pilea', 'Peperomia sandía', 'Selaginela', 'Ficus enano', 'Singonio mini',
      'Cryptanthus', 'Lágrimas de bebé', 'Culantrillo enano', 'Begonia mini', 'Marcgravia',
      'Peperomia trepadora', 'Nephrolepis exaltata', 'Adiantum raddianum', 'Pteris ensiformis',
      'Asplenium nidus', 'Pilea glauca', 'Peperomia rotundifolia', 'Fittonia verschaffeltii',
      'Selaginella martensii', 'Begonia rex', 'Calathea orbifolia', 'Maranta leuconeura',
      'Ficus pumila', 'Hemigraphis alternata', 'Episcia cupreata', 'Sinningia pusilla',
      'Saintpaulia mini', 'Utricularia graminifolia', 'Drosera spatulata', 'Pinguicula',
      'Sarracenia mini', 'Nepenthes mini', 'Anubias barteri', 'Bucephalandra',
      'Microsorum pteropus', 'Riccia fluitans', 'Marchantia', 'Pellionia repens', 'Codonanthe',
      'Columnea', 'Alocasia mini', 'Homalomena', 'Spathiphyllum mini',
      'Chamaedorea elegans mini', 'Rhipsalis', 'Neoregelia mini', 'Guzmania mini',
      'Tillandsia ionantha', 'Cryptanthus bromelioides',
    ],
    plantasTop: [
      'Fitonia', 'Pilea', 'Peperomia sandía', 'Selaginela', 'Ficus enano', 'Singonio mini',
      'Cryptanthus', 'Lágrimas de bebé', 'Culantrillo enano', 'Begonia mini',
    ],
  },
};

/**
 * La portada de cada terrario es una foto propia (subida en la Galería de su
 * bitácora), no la imagen de catálogo de una planta — un terrario es un
 * objeto físico distinto de las especies que tiene adentro.
 */
async function obtenerImagenesPortada(terrarios) {
  const portadas = new Map();
  await Promise.all(
    terrarios.map(async (terrario) => {
      try {
        const foto = await obtenerFotoPortada(terrario.id);
        if (foto) portadas.set(terrario.id, { foto, url: await obtenerUrlFoto(foto.storage_path) });
      } catch (err) {
        console.error('Error obteniendo la portada del terrario', err);
      }
    })
  );
  return portadas;
}

/**
 * Un tile por terrario (su foto de portada), que lleva directo a su
 * bitácora — ahí vive el contenido completo del terrario (sus ítems,
 * cuidados, riego, galería).
 */
function crearTileTerrario(terrario, portada) {
  const tile = document.createElement('a');
  tile.className = 'coleccion-terrario-tile';
  tile.href = `bitacora.html?id=${encodeURIComponent(terrario.id)}`;
  tile.dataset.terrarioId = terrario.id;

  const imagenDiv = document.createElement('div');
  imagenDiv.className = 'coleccion-terrario-tile-imagen';
  if (portada?.url) imagenDiv.style.backgroundImage = `url("${portada.url}")`;
  tile.appendChild(imagenDiv);

  const nombre = document.createElement('span');
  nombre.className = 'coleccion-terrario-tile-nombre';
  nombre.textContent = terrario.nombre;
  tile.appendChild(nombre);

  return tile;
}

function crearSeccionTipo(tipo, grupos, portadas) {
  const section = document.createElement('section');
  section.className = 'coleccion-tipo-group';

  const titulo = document.createElement('h2');
  titulo.className = 'coleccion-tipo-titulo';
  titulo.innerHTML = `
    <span class="coleccion-tipo-titulo-label">${escapeHtml(TIPO_TITULO[tipo])}</span>
    <span class="coleccion-tipo-titulo-count">(${grupos.length})</span>
  `;
  section.appendChild(titulo);

  if (grupos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'coleccion-tipo-vacio';
    vacio.textContent = `Todavía no creaste ningún terrario ${tipo}.`;
    section.appendChild(vacio);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'coleccion-grid';
  for (const { terrario } of grupos) {
    grid.appendChild(crearTileTerrario(terrario, portadas.get(terrario.id)));
  }
  section.appendChild(grid);

  return section;
}

/**
 * Fila de la lista de un tipo específico: una imagen más grande que el tile
 * de la vista combinada, apiladas una debajo de la otra en una sola columna.
 */
function crearFilaSplit(terrario, portada) {
  const fila = document.createElement('a');
  fila.className = 'coleccion-split-fila';
  fila.href = `bitacora.html?id=${encodeURIComponent(terrario.id)}`;

  const meta = document.createElement('div');
  meta.className = 'coleccion-split-fila-meta';

  const fecha = document.createElement('span');
  fecha.className = 'coleccion-split-fila-fecha';
  fecha.textContent = formatFechaCorta(terrario.created_at);
  meta.appendChild(fecha);

  const nombre = document.createElement('span');
  nombre.className = 'coleccion-split-fila-nombre';
  nombre.textContent = terrario.nombre;
  meta.appendChild(nombre);

  fila.appendChild(meta);

  const imagenDiv = document.createElement('div');
  imagenDiv.className = 'coleccion-split-fila-imagen';
  if (portada?.url) imagenDiv.style.backgroundImage = `url("${portada.url}")`;

  const acciones = document.createElement('div');
  acciones.className = 'coleccion-split-fila-imagen-acciones';

  const accionCargar = document.createElement('button');
  accionCargar.type = 'button';
  accionCargar.className = 'coleccion-split-fila-imagen-accion';
  accionCargar.textContent = portada ? '(Cambiar)' : '(Cargar)';
  accionCargar.dataset.accion = 'cargar';
  accionCargar.dataset.terrarioId = terrario.id;
  acciones.appendChild(accionCargar);

  if (portada) {
    const accionBorrar = document.createElement('button');
    accionBorrar.type = 'button';
    accionBorrar.className = 'coleccion-split-fila-imagen-accion';
    accionBorrar.textContent = '(Borrar)';
    accionBorrar.dataset.accion = 'borrar';
    accionBorrar.dataset.fotoId = portada.foto.id;
    accionBorrar.dataset.fotoPath = portada.foto.storage_path;
    acciones.appendChild(accionBorrar);
  }

  imagenDiv.appendChild(acciones);
  fila.appendChild(imagenDiv);

  return fila;
}

/**
 * Columna sticky con info general del tipo de terrario (no de los terrarios
 * puntuales del usuario): qué es, cómo cuidarlo, qué plantas le van bien.
 */
function crearCopySplit(tipo) {
  const info = TIPO_INFO[tipo];
  const aside = document.createElement('aside');
  aside.className = 'coleccion-split-copy';
  aside.innerHTML = `
    <h1 class="coleccion-split-titulo">${escapeHtml(TIPO_TITULO_SPLIT[tipo])}</h1>
    <p class="coleccion-split-label-texto">(Concepto)</p>
    ${info.descripcion.map((p) => `<p class="coleccion-split-descripcion">${escapeHtml(p)}</p>`).join('')}
    ${
      info.armado
        ? `
          <p class="coleccion-split-label-texto">(Armado)</p>
          <p class="coleccion-split-descripcion">_ ${info.armado
            .map((a) => `${escapeHtml(a.capa)} ${escapeHtml(a.detalle)}`)
            .join(' // ')}</p>
        `
        : ''
    }
    <p class="coleccion-split-label-texto">(Cuidados)</p>
    <ul class="coleccion-split-cuidados">
      ${info.cuidados.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
    </ul>
    <p class="coleccion-split-label-texto">(Plantas + usadas)</p>
    <p class="coleccion-split-descripcion">${info.plantasTop.map((p) => escapeHtml(p)).join(' // ')}</p>
    <p class="coleccion-split-label-texto">(Plantas usadas)</p>
    <p class="coleccion-split-descripcion">${info.plantas.map((p) => escapeHtml(p)).join(' // ')}</p>
  `;
  return aside;
}

function renderSplit(root, tipo, grupos, portadas) {
  const split = document.createElement('div');
  split.className = 'coleccion-split';

  const lista = document.createElement('div');
  lista.className = 'coleccion-split-lista';

  if (grupos.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'coleccion-tipo-vacio';
    vacio.textContent = `Todavía no creaste ningún terrario ${tipo}.`;
    lista.appendChild(vacio);
  } else {
    for (const { terrario } of grupos) {
      lista.appendChild(crearFilaSplit(terrario, portadas.get(terrario.id)));
    }
  }

  split.appendChild(lista);
  split.appendChild(crearCopySplit(tipo));
  root.appendChild(split);
}

function marcarNavActivo(tipo) {
  qsa('.catalog-nav-sublink, .catalog-sidebar-sublink').forEach((link) => {
    const esDeEsteTipo = tipo && link.getAttribute('href')?.includes(`tipo=${tipo}`);
    link.classList.toggle('is-active', Boolean(esDeEsteTipo));
  });
}

async function render(root) {
  const vacio = qs('#mensaje-vacio');
  if (!root || !vacio) return;

  const [terrarios, items] = await Promise.all([listarTerrarios(), listarColeccion()]);
  const portadas = await obtenerImagenesPortada(terrarios);
  root.innerHTML = '';

  const itemsPorTerrario = new Map();
  for (const item of items) {
    const lista = itemsPorTerrario.get(item.terrario_id) || [];
    lista.push(item);
    itemsPorTerrario.set(item.terrario_id, lista);
  }

  const porTipo = { abierto: [], cerrado: [] };
  for (const terrario of terrarios) {
    porTipo[terrario.tipo]?.push({ terrario, items: itemsPorTerrario.get(terrario.id) || [] });
  }

  const tipoParam = new URLSearchParams(window.location.search).get('tipo');
  marcarNavActivo(tipoParam);

  if (tipoParam === 'abierto' || tipoParam === 'cerrado') {
    vacio.hidden = true;
    renderSplit(root, tipoParam, porTipo[tipoParam], portadas);
    await syncColeccionNavCount();
    return;
  }

  vacio.textContent = MENSAJE_SIN_TERRARIOS;
  vacio.hidden = terrarios.length > 0;

  root.appendChild(crearSeccionTipo('abierto', porTipo.abierto, portadas));
  root.appendChild(crearSeccionTipo('cerrado', porTipo.cerrado, portadas));

  await syncColeccionNavCount();
}

/**
 * Al pasar el mouse por el tile de un terrario, el resto se atenúa — así
 * queda claro cuál es cuál sin necesidad de separadores visuales pesados.
 */
function wireHoverAislado(root) {
  if (!root) return;

  root.addEventListener('mouseover', (event) => {
    const tile = event.target.closest('.coleccion-terrario-tile');
    if (!tile || !root.contains(tile)) return;

    root.classList.add('has-hover');
    qsa('.coleccion-terrario-tile', root).forEach((t) => {
      t.classList.toggle('is-active', t === tile);
    });
  });

  root.addEventListener('mouseout', (event) => {
    const tile = event.target.closest('.coleccion-terrario-tile');
    if (!tile || !root.contains(tile)) return;
    if (tile.contains(event.relatedTarget)) return;

    root.classList.remove('has-hover');
    qsa('.coleccion-terrario-tile', root).forEach((t) => t.classList.remove('is-active'));
  });
}

function crearInputPortadaOculto() {
  let input = document.getElementById('input-portada-oculto');
  if (input) return input;

  input = document.createElement('input');
  input.type = 'file';
  input.id = 'input-portada-oculto';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif';
  input.hidden = true;
  document.body.appendChild(input);
  return input;
}

/**
 * Los botones "(Cargar/Cambiar)" y "(Borrar)" viven dentro de la fila, que es
 * un link a la bitácora — hay que frenar esa navegación y manejar la acción
 * (abrir el selector de archivo, o borrar la portada) en su lugar.
 */
function wireImagenPortada(root) {
  if (!root) return;

  const input = crearInputPortadaOculto();
  let terrarioObjetivo = null;

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('.coleccion-split-fila-imagen-accion');
    if (!btn || !root.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();

    if (btn.dataset.accion === 'borrar') {
      if (btn.disabled) return;
      btn.disabled = true;
      eliminarFotoTerrario({ id: btn.dataset.fotoId, storage_path: btn.dataset.fotoPath })
        .then((result) => {
          if (result.ok) return render(root);
          btn.disabled = false;
          mostrarErrorDePagina('No pudimos borrar la imagen. Probá otra vez.');
        })
        .catch((err) => {
          console.error('Error borrando la portada', err);
          btn.disabled = false;
          mostrarErrorDePagina('No pudimos borrar la imagen. Probá otra vez.');
        });
      return;
    }

    terrarioObjetivo = btn.dataset.terrarioId;
    input.value = '';
    input.click();
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    const terrarioId = terrarioObjetivo;
    terrarioObjetivo = null;
    if (!file || !terrarioId) return;

    const result = await subirPortadaTerrario(terrarioId, file);
    if (result.ok) {
      await render(root);
    } else {
      mostrarErrorDePagina('No pudimos subir la imagen. Probá otra vez.');
    }
  });
}

function toggleSidebar() {
  const sidebar = qs('#catalog-sidebar');
  const toggle = qs('#catalog-menu-toggle');
  if (!sidebar || !toggle) return;

  const isOpen = sidebar.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', isOpen);
  document.body.classList.toggle('sidebar-open', isOpen);
}

function closeSidebar() {
  const sidebar = qs('#catalog-sidebar');
  const toggle = qs('#catalog-menu-toggle');
  if (!sidebar || !toggle) return;

  sidebar.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');
}

function wireSidebarToggle() {
  const toggle = qs('#catalog-menu-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', toggleSidebar);

  const closeBtn = qs('#catalog-sidebar-close');
  closeBtn?.addEventListener('click', closeSidebar);

  const backdrop = document.body;
  backdrop.addEventListener('click', (event) => {
    const sidebar = qs('#catalog-sidebar');
    if (sidebar && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      closeSidebar();
    }
  });
}

const MENSAJE_SIN_SESION = 'Iniciá sesión para ver los ítems de tu colección.';
const MENSAJE_SIN_TERRARIOS =
  'Todavía no creaste ningún terrario. Sumá algo desde Index para crear el primero.';

const root = qs('#coleccion-rows');
const authModal = wireAuthModal();
const authNav = wireAuthNav({ onLogin: abrirLogin });

let coleccionActiva = false;

function abrirLogin() {
  authModal.open({
    onSuccess: async () => {
      await authNav.sync();
      activarColeccion();
    },
  });
}

function montarChrome() {
  wireReloj();
  wireThemeToggle();
  wireSeasonTheme();
  wireSidebarToggle();
  wireSidebarAccordion();
  wireHoverAislado(root);
  wireImagenPortada(root);
}

function mostrarEstadoSinSesion() {
  if (root) root.innerHTML = '';
  const vacio = qs('#mensaje-vacio');
  if (vacio) {
    vacio.textContent = MENSAJE_SIN_SESION;
    vacio.hidden = false;
  }
  syncColeccionNavCount();
}

function activarColeccion() {
  render(root);
  syncColeccionNavCount();

  if (coleccionActiva) return;
  coleccionActiva = true;

  const unsubscribe = onColeccionChange(() => {
    render(root).catch(console.error);
  });

  window.addEventListener('beforeunload', unsubscribe, { once: true });
}

iniciarPagina(async function init() {
  qs('#coleccion-contenido').hidden = false;
  montarChrome();
  await authNav.sync();

  if (await getSession()) {
    activarColeccion();
    return;
  }

  mostrarEstadoSinSesion();
});
