import { qs, escapeHtml } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { listarTerrarios } from '../services/terrarios.js';
import { listarCuidadosTerrario } from '../services/terrario-cuidados.js';
import { calcularProximoVencimiento } from '../utils/recordatorios.js';
import { textoProximoRiego } from '../utils/riego-frecuencia.js';
import { syncColeccionNavCount } from '../utils/coleccion-nav.js';
import { wireAuthModal } from '../utils/auth-modal.js';
import { wireAuthNav } from '../utils/auth-nav.js';
import { wireReloj } from '../utils/reloj.js';
import { wireThemeToggle } from '../utils/theme.js';
import { wireSeasonTheme } from '../utils/catalog-season-theme.js';
import { iniciarPagina } from '../utils/guard.js';
import { wireSidebarAccordion } from '../utils/catalog-sidebar-accordion.js';

function ultimoRiegoDe(eventos) {
  return eventos.find((evento) => evento.tipo === 'regar') ?? null;
}

async function calcularDatosTerrario(terrario) {
  const eventos = await listarCuidadosTerrario(terrario.id);
  const frecuenciaDias = terrario.riego_frecuencia_dias;
  const ultimo = ultimoRiegoDe(eventos);
  const proxima =
    frecuenciaDias == null
      ? null
      : calcularProximoVencimiento({
          ultimaFecha: ultimo?.fecha ?? null,
          fechaAlta: terrario.created_at,
          frecuenciaDias,
        });

  return { terrario, ultimo, proxima };
}

function filaMarkup(nombre, id, texto) {
  return `
    <li class="riegos-row">
      <a class="riegos-row-link" href="bitacora.html?id=${escapeHtml(id)}">
        <span class="riegos-row-nombre">${escapeHtml(nombre)}</span>
        <span class="riegos-row-linea" aria-hidden="true"></span>
        <span class="riegos-row-valor">${escapeHtml(texto)}</span>
      </a>
    </li>
  `;
}

function renderProximos(datos) {
  const lista = qs('#riegos-proximos');
  const conProxima = datos
    .filter((d) => d.proxima != null)
    .sort((a, b) => a.proxima.getTime() - b.proxima.getTime());

  if (!conProxima.length) {
    lista.innerHTML = '<li class="riegos-vacio">Nada por regar todavía.</li>';
    return;
  }

  lista.innerHTML = conProxima
    .map((d) => filaMarkup(d.terrario.nombre, d.terrario.id, textoProximoRiego(d.proxima)))
    .join('');
}

async function render() {
  const vacio = qs('#mensaje-vacio');
  const terrarios = await listarTerrarios();

  if (terrarios.length === 0) {
    vacio.hidden = false;
    qs('#riegos-proximos').innerHTML = '';
    return;
  }

  vacio.hidden = true;
  const datos = await Promise.all(terrarios.map(calcularDatosTerrario));
  renderProximos(datos);
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

  document.body.addEventListener('click', (event) => {
    const sidebar = qs('#catalog-sidebar');
    if (sidebar && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      closeSidebar();
    }
  });
}

const MENSAJE_SIN_SESION = 'Iniciá sesión para ver los riegos de tus terrarios.';

const authModal = wireAuthModal();
const authNav = wireAuthNav({ onLogin: abrirLogin });

function abrirLogin() {
  authModal.open({
    onSuccess: async () => {
      await authNav.sync();
      await render();
    },
  });
}

function mostrarEstadoSinSesion() {
  const vacio = qs('#mensaje-vacio');
  qs('#riegos-proximos').innerHTML = '';
  if (vacio) {
    vacio.textContent = MENSAJE_SIN_SESION;
    vacio.hidden = false;
  }
  syncColeccionNavCount();
}

iniciarPagina(async function init() {
  qs('#riegos-contenido').hidden = false;
  wireReloj();
  wireThemeToggle();
  wireSeasonTheme();
  wireSidebarToggle();
  wireSidebarAccordion();
  await authNav.sync();

  if (await getSession()) {
    await render();
    await syncColeccionNavCount();
    return;
  }

  mostrarEstadoSinSesion();
});
