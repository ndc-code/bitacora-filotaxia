import { qs, escapeHtml, showError, clearError } from '../utils/dom.js';
import { getSession } from '../services/auth.js';
import { obtenerTerrario, actualizarTerrario, eliminarTerrario } from '../services/terrarios.js';
import { listarColeccion, quitarDeColeccion } from '../services/coleccion.js';
import { idDeColeccion } from '../utils/coleccion-card.js';
import {
  listarCuidadosTerrario,
  registrarCuidadoTerrario,
  eliminarCuidadoTerrario,
} from '../services/terrario-cuidados.js';
import {
  FOTOS_LIMITE,
  listarFotosTerrario,
  subirFotoTerrario,
  eliminarFotoTerrario,
  obtenerFotoPortada,
} from '../services/terrario-fotos.js';
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

const ETIQUETAS_TIPO = {
  regar: 'Regar',
  fertilizar: 'Fertilizar',
  trasplantar: 'Trasplantar',
  podar: 'Podar',
  observacion: 'Observación',
  otro: 'Otro',
};

const TIPO_LABEL = { abierto: 'Terrario abierto', cerrado: 'Terrario cerrado' };

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const terrarioId = new URLSearchParams(window.location.search).get('id');

let mesCalendario = new Date();
mesCalendario.setDate(1);
let calendarioCtx = null;

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
  qs('#catalog-sidebar-close')?.addEventListener('click', closeSidebar);
  document.body.addEventListener('click', (event) => {
    const sidebar = qs('#catalog-sidebar');
    if (
      sidebar &&
      sidebar.classList.contains('is-open') &&
      !sidebar.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      closeSidebar();
    }
  });
}

async function renderFoto(terrario) {
  let url = '';
  try {
    const portada = await obtenerFotoPortada(terrario.id);
    if (portada) url = await obtenerUrlFoto(portada.storage_path);
  } catch (err) {
    console.error('Error obteniendo la portada del terrario', err);
  }
  qs('#bitacora-foto').innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(terrario.nombre || '')}" />`
    : '';
}

async function renderGaleriaGrid(terrarioId) {
  const grid = qs('#bitacora-galeria-grid');
  const fotos = await listarFotosTerrario(terrarioId);

  if (!fotos.length) {
    grid.innerHTML = '<p class="bitacora-galeria-vacio">Todavía no subiste fotos de este terrario.</p>';
    return;
  }

  const urls = await Promise.all(
    fotos.map((foto) => obtenerUrlFoto(foto.storage_path).catch(() => null))
  );

  grid.innerHTML = fotos
    .map((foto, i) => {
      const url = urls[i];
      if (!url) return '';
      return `
        <figure class="bitacora-galeria-item" data-id="${escapeHtml(foto.id)}" data-path="${escapeHtml(foto.storage_path)}">
          <img src="${escapeHtml(url)}" alt="" loading="lazy" />
          <figcaption>${escapeHtml(formatFechaCorta(foto.created_at))}</figcaption>
          <button type="button" class="bitacora-galeria-eliminar" aria-label="Eliminar foto">×</button>
        </figure>
      `;
    })
    .join('');
}

function descripcionDe(terrario, cantidadItems) {
  const tipo = TIPO_LABEL[terrario.tipo] || '';
  const cantidad = `${cantidadItems} ${cantidadItems === 1 ? 'ítem' : 'ítems'}`;
  const bajada = [tipo, cantidad].filter(Boolean).join(' · ');
  const enColeccion = terrario.created_at
    ? `Creado el ${formatFechaCorta(terrario.created_at)}.`
    : '';
  return [bajada, enColeccion].filter(Boolean).join(' — ');
}

function filaDetalleMarkup(indice, nombre, valor) {
  return `
    <li class="bitacora-detalle-item">
      <span class="bitacora-detalle-nombre"><span class="bitacora-detalle-idx">${String(indice).padStart(2, '0')}</span>${nombre}</span>
      <span class="bitacora-detalle-valor">${valor}</span>
    </li>
  `;
}

function filaRiegoFrecuenciaMarkup(indice, frecuenciaDias) {
  return `
    <li class="bitacora-detalle-item">
      <span class="bitacora-detalle-nombre"><span class="bitacora-detalle-idx">${String(indice).padStart(2, '0')}</span>Regar cada</span>
      <span class="bitacora-detalle-valor">
        <input class="bitacora-input" type="number" min="1" id="input-riego-frecuencia" value="${frecuenciaDias ?? ''}" placeholder="días" style="width: 80px;" /> días
      </span>
    </li>
  `;
}

function renderDetalle(terrario, cantidadItems) {
  qs('#bitacora-detalle').innerHTML = [
    filaDetalleMarkup(1, 'Tipo', escapeHtml(TIPO_LABEL[terrario.tipo] || '—')),
    filaDetalleMarkup(2, 'Ítems', String(cantidadItems)),
    filaRiegoFrecuenciaMarkup(3, terrario.riego_frecuencia_dias),
  ].join('');
}

function wireRiegoFrecuencia(terrario) {
  const input = qs('#input-riego-frecuencia');
  if (!input) return;

  input.addEventListener('change', async () => {
    const numero = Number.parseInt(input.value, 10);
    const valor = Number.isFinite(numero) && numero >= 1 ? numero : null;
    input.value = valor ?? '';

    const result = await actualizarTerrario(terrario.id, { riego_frecuencia_dias: valor });
    if (result.ok) {
      terrario.riego_frecuencia_dias = valor;
      actualizarCalendario(terrario, calendarioCtx?.eventos || []);
    }
  });
}

function renderNotas(eventos) {
  const lista = qs('#bitacora-notas');
  if (!eventos.length) {
    lista.innerHTML = '<li class="bitacora-nota-vacio">Todavía no hay anotaciones.</li>';
    return;
  }
  lista.innerHTML = eventos
    .map(
      (evento) => `
        <li class="bitacora-nota-item" data-id="${escapeHtml(evento.id)}">
          <span class="bitacora-nota-fecha">${escapeHtml(formatFechaCorta(evento.fecha))}</span>
          <span class="bitacora-nota-texto">
            ${escapeHtml(ETIQUETAS_TIPO[evento.tipo] || evento.tipo)}
            ${evento.notas ? `— ${escapeHtml(evento.notas)}` : ''}
          </span>
          <button type="button" class="coleccion-eliminar-btn bitacora-nota-eliminar">eliminar</button>
        </li>
      `
    )
    .join('');
}

function mismoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fechasDeRiego(fechaInicio, frecuenciaDias) {
  if (!frecuenciaDias || !fechaInicio) return [];
  const fechas = [];
  let actual = new Date(fechaInicio);
  actual.setHours(0, 0, 0, 0);
  const limite = new Date(actual);
  limite.setFullYear(limite.getFullYear() + 1);
  while (actual <= limite) {
    fechas.push(new Date(actual));
    actual = new Date(actual);
    actual.setDate(actual.getDate() + frecuenciaDias);
  }
  return fechas;
}

function renderCalendario() {
  const cont = qs('#bitacora-calendario');
  if (!cont || !calendarioCtx) return;

  const { terrario, eventos } = calendarioCtx;
  const frecuenciaDias = terrario.riego_frecuencia_dias;
  const fechasRiego = fechasDeRiego(terrario.created_at, frecuenciaDias);

  const anio = mesCalendario.getFullYear();
  const mes = mesCalendario.getMonth();
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const offset = (primerDia.getDay() + 6) % 7;
  const hoy = new Date();

  const celdas = [];
  for (let i = 0; i < offset; i++) {
    celdas.push('<span class="bitacora-calendario-celda is-vacia"></span>');
  }
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const fecha = new Date(anio, mes, dia);
    const clases = ['bitacora-calendario-celda'];
    const eventosDia = eventos.filter((e) => e.tipo === 'regar' && mismoDia(new Date(e.fecha), fecha));
    const esDebida = fechasRiego.some((f) => mismoDia(f, fecha));
    if (eventosDia.length) {
      clases.push('is-regado');
    } else if (esDebida) {
      clases.push('is-riego');
    }
    if (mismoDia(fecha, hoy)) clases.push('is-hoy');
    const interactiva = eventosDia.length > 0 || esDebida;
    const idsRegado = eventosDia.map((e) => e.id).join(',');
    celdas.push(
      `<button type="button" class="${clases.join(' ')}" data-dia="${dia}" data-evento-ids="${idsRegado}" ${interactiva ? '' : 'disabled'}>${dia}</button>`
    );
  }

  cont.innerHTML = `
    <div class="bitacora-calendario-header">
      <button type="button" class="bitacora-calendario-nav" data-mes="-1" aria-label="Mes anterior">‹</button>
      <p class="bitacora-calendario-mes">${MESES_LARGOS[mes]} ${anio}</p>
      <button type="button" class="bitacora-calendario-nav" data-mes="1" aria-label="Mes siguiente">›</button>
    </div>
    <div class="bitacora-calendario-dias">
      ${DIAS_SEMANA.map((d) => `<span class="bitacora-calendario-dia-nombre">${d}</span>`).join('')}
    </div>
    <div class="bitacora-calendario-grid">${celdas.join('')}</div>
    ${frecuenciaDias ? '' : '<p class="bitacora-calendario-vacio">Configurá la frecuencia de riego de este terrario para ver las próximas fechas.</p>'}
  `;
}

function actualizarCalendario(terrario, eventos) {
  calendarioCtx = { terrario, eventos };
  renderCalendario();
}

function wireCalendario(terrario) {
  const cont = qs('#bitacora-calendario');
  if (!cont || cont.dataset.wired) return;
  cont.dataset.wired = '1';
  cont.addEventListener('click', async (event) => {
    const navBtn = event.target.closest('.bitacora-calendario-nav');
    if (navBtn) {
      mesCalendario.setMonth(mesCalendario.getMonth() + Number(navBtn.dataset.mes));
      renderCalendario();
      return;
    }

    const celda = event.target.closest('.bitacora-calendario-celda');
    if (!celda || celda.disabled || !celda.dataset.dia) return;

    const idsRegado = celda.dataset.eventoIds ? celda.dataset.eventoIds.split(',') : [];

    celda.disabled = true;
    try {
      if (idsRegado.length) {
        await Promise.all(idsRegado.map((id) => eliminarCuidadoTerrario(id)));
      } else {
        const fecha = new Date(
          mesCalendario.getFullYear(),
          mesCalendario.getMonth(),
          Number(celda.dataset.dia),
          12
        );
        await registrarCuidadoTerrario(terrario.id, 'regar', fecha.toISOString(), null);
      }
      await pintarBitacora(terrario);
    } catch (err) {
      console.error('No se pudo actualizar el riego', err);
      celda.disabled = false;
    }
  });
}

const MENSAJES_ERROR_FOTO = {
  tipo_invalido: 'Ese archivo no es una imagen válida (jpg, png, webp o gif).',
  muy_pesada: 'La imagen pesa más de 5MB. Probá con una más liviana.',
  limite_alcanzado: `Ya llegaste al máximo de ${FOTOS_LIMITE} fotos para este terrario.`,
  not_authenticated: 'Iniciá sesión de nuevo para subir fotos.',
  error: 'No pudimos subir la foto. Probá otra vez.',
};

function wireSubidaFoto(terrario) {
  const input = qs('#input-foto-galeria');
  const errorEl = qs('#error-galeria');
  if (!input) return;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    clearError(errorEl);

    try {
      const result = await subirFotoTerrario(terrario.id, file);
      if (!result.ok) {
        showError(errorEl, MENSAJES_ERROR_FOTO[result.reason] ?? MENSAJES_ERROR_FOTO.error);
        return;
      }
      await Promise.all([renderGaleriaGrid(terrario.id), renderFoto(terrario)]);
    } catch (err) {
      console.error('Error subiendo foto', err);
      showError(errorEl, MENSAJES_ERROR_FOTO.error);
    } finally {
      input.value = '';
    }
  });
}

function wireEliminarFoto(terrario) {
  const grid = qs('#bitacora-galeria-grid');
  if (!grid) return;

  grid.addEventListener('click', async (event) => {
    const btn = event.target.closest('.bitacora-galeria-eliminar');
    if (!btn) return;

    const item = btn.closest('.bitacora-galeria-item');
    const id = item?.dataset.id;
    if (!id || btn.disabled) return;

    btn.disabled = true;
    try {
      const result = await eliminarFotoTerrario({ id, storage_path: item.dataset.path });
      if (!result.ok) {
        console.error('No se pudo eliminar la foto', result.error);
        btn.disabled = false;
        return;
      }
      await Promise.all([renderGaleriaGrid(terrario.id), renderFoto(terrario)]);
    } catch (err) {
      console.error('Error eliminando foto', err);
      btn.disabled = false;
    }
  });
}

function wireEliminarNota(terrario) {
  const lista = qs('#bitacora-notas');
  if (!lista) return;

  lista.addEventListener('click', async (event) => {
    const btn = event.target.closest('.bitacora-nota-eliminar');
    if (!btn) return;

    const item = btn.closest('.bitacora-nota-item');
    const id = item?.dataset.id;
    if (!id || btn.disabled) return;

    btn.disabled = true;
    try {
      await eliminarCuidadoTerrario(id);
      await pintarBitacora(terrario);
    } catch (err) {
      console.error('No se pudo eliminar la nota', err);
      btn.disabled = false;
    }
  });
}

function mostrarSolo(idVisible) {
  qs('#mensaje-sesion').hidden = idVisible !== 'mensaje-sesion';
  qs('#mensaje-faltante').hidden = idVisible !== 'mensaje-faltante';
  qs('#bitacora-contenido').hidden = idVisible !== 'bitacora-contenido';
  const errorEl = qs('#error-pagina');
  if (errorEl) errorEl.hidden = idVisible !== 'error-pagina';
}

let terrarioActual = null;

function crearTarjetaItem(item) {
  const id = idDeColeccion(item);
  const nombre = escapeHtml(item.nombre || '');
  const imagen = item.imagen || (Array.isArray(item.galeria) ? item.galeria[0] : '') || '';

  const card = document.createElement('div');
  card.className = 'terrario-item';
  card.dataset.id = id;

  const imagenDiv = document.createElement('div');
  imagenDiv.className = 'terrario-item-imagen';
  if (imagen) imagenDiv.style.backgroundImage = `url("${imagen}")`;
  card.appendChild(imagenDiv);

  card.innerHTML += `
    <div class="terrario-item-info">
      <span class="terrario-item-nombre">${nombre}</span>
      <button type="button" class="coleccion-eliminar-btn" data-id="${escapeHtml(id)}" title="Eliminar de Colección" aria-label="Eliminar ${nombre} de Colección">Eliminar</button>
    </div>
  `;

  return card;
}

function renderItems(items) {
  const grid = qs('#terrario-grid');
  const vacio = qs('#terrario-vacio');
  if (!grid || !vacio) return;

  grid.innerHTML = '';
  vacio.hidden = items.length > 0;

  for (const item of items) {
    grid.appendChild(crearTarjetaItem(item));
  }
}

function wireEliminarItem() {
  const grid = qs('#terrario-grid');
  if (!grid) return;

  grid.addEventListener('click', async (event) => {
    const btn = event.target.closest('.coleccion-eliminar-btn');
    if (!btn) return;

    event.preventDefault();

    const id = btn.dataset.id;
    if (!id || btn.disabled) return;

    btn.disabled = true;
    const result = await quitarDeColeccion(id);

    if (result.ok || result.reason === 'missing') {
      await pintarBitacora(terrarioActual);
      return;
    }

    btn.disabled = false;
    mostrarErrorDePagina('No pudimos eliminar el ítem de este terrario. Probá otra vez.');
  });
}

function wireEliminarTerrarioBtn() {
  const btn = qs('#btn-eliminar-terrario');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const confirmado = window.confirm('¿Eliminar este terrario? No se puede deshacer.');
    if (!confirmado) return;

    btn.disabled = true;
    const result = await eliminarTerrario(terrarioActual.id);

    if (result.ok) {
      window.location.href = 'coleccion.html';
      return;
    }

    btn.disabled = false;
    mostrarErrorDePagina('No pudimos eliminar el terrario. Probá otra vez.');
  });
}

async function pintarBitacora(terrario) {
  terrarioActual = terrario;
  const [eventos, items] = await Promise.all([
    listarCuidadosTerrario(terrario.id),
    listarColeccion().then((todos) => todos.filter((item) => item.terrario_id === terrario.id)),
  ]);

  await renderFoto(terrario);
  qs('#bitacora-nombre').textContent = terrario.nombre || '';
  qs('#bitacora-especie').textContent = descripcionDe(terrario, items.length);
  document.title = `${terrario.nombre || 'Bitácora'} — Filotaxia`;
  renderDetalle(terrario, items.length);
  wireRiegoFrecuencia(terrario);
  renderItems(items);
  renderNotas(eventos);
  actualizarCalendario(terrario, eventos);
  await renderGaleriaGrid(terrario.id);
}

function wireAgregarEntrada() {
  const btn = qs('#bitacora-agregar-btn');
  const form = qs('#form-cuidado');
  if (!btn || !form) return;

  btn.addEventListener('click', () => {
    const abrir = form.hidden;
    form.hidden = !abrir;
    btn.textContent = abrir ? 'Cancelar' : '+ Agregar entrada';
    if (abrir) qs('#tipo-cuidado')?.focus();
  });
}

function wireTipoCuidado() {
  const select = qs('#tipo-cuidado');
  const label = qs('#label-notas-cuidado');
  const input = qs('#notas-cuidado');
  if (!select || !label || !input) return;

  const actualizar = () => {
    const esObservacion = select.value === 'observacion';
    label.textContent = esObservacion ? 'Qué observaste' : 'Notas';
    input.placeholder = esObservacion ? 'Contá qué notaste en el terrario' : 'Opcional';
  };

  select.addEventListener('change', actualizar);
  actualizar();
}

function wireFormCuidado(terrario) {
  const form = qs('#form-cuidado');
  const errorEl = qs('#error-cuidado');
  const submitBtn = form.querySelector('[type="submit"]');
  const agregarBtn = qs('#bitacora-agregar-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitBtn?.disabled) return;
    clearError(errorEl);

    const tipo = qs('#tipo-cuidado').value;
    const notas = qs('#notas-cuidado').value || null;

    if (tipo === 'observacion' && !notas) {
      showError(errorEl, 'Contá qué observaste en el terrario.');
      qs('#notas-cuidado').focus();
      return;
    }

    const textoOriginal = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando…';
    }

    try {
      if (!(await getSession())) {
        showError(errorEl, 'Iniciá sesión para registrar un cuidado.');
        authNav.sync();
        authModal.open({
          onSuccess: async () => {
            await authNav.sync();
            clearError(errorEl);
          },
        });
        return;
      }

      await registrarCuidadoTerrario(terrario.id, tipo, new Date().toISOString(), notas);
      form.reset();
      qs('#tipo-cuidado').value = 'regar';
      form.hidden = true;
      if (agregarBtn) agregarBtn.textContent = '+ Agregar entrada';
      await pintarBitacora(terrario);
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = textoOriginal;
      }
    }
  });
}

async function cargarTerrario() {
  if (!terrarioId) {
    mostrarSolo('mensaje-faltante');
    return null;
  }

  let terrario;
  try {
    terrario = await obtenerTerrario(terrarioId);
  } catch (err) {
    console.error('No se pudo cargar el terrario', err);
    mostrarSolo('error-pagina');
    mostrarErrorDePagina('No pudimos cargar este terrario. Probá otra vez.');
    return null;
  }

  if (!terrario) {
    mostrarSolo('mensaje-faltante');
    return null;
  }

  try {
    await pintarBitacora(terrario);
  } catch (err) {
    console.error('No se pudo cargar la bitácora', err);
    mostrarSolo('error-pagina');
    mostrarErrorDePagina('No pudimos cargar este terrario. Probá otra vez.');
    return null;
  }

  mostrarSolo('bitacora-contenido');
  return terrario;
}

function wireDetalleTerrario(terrario) {
  if (!terrario || qs('#form-cuidado').dataset.wired) return;
  qs('#form-cuidado').dataset.wired = '1';

  wireFormCuidado(terrario);
  wireAgregarEntrada();
  wireTipoCuidado();
  wireEliminarNota(terrario);
  wireSubidaFoto(terrario);
  wireEliminarFoto(terrario);
  wireCalendario(terrario);
  wireEliminarItem();
  wireEliminarTerrarioBtn();
}

const authModal = wireAuthModal();
const authNav = wireAuthNav({
  onLogin: () => {
    authModal.open({
      onSuccess: async () => {
        await authNav.sync();
        await syncColeccionNavCount();
        const terrario = await cargarTerrario();
        wireDetalleTerrario(terrario);
      },
    });
  },
});

iniciarPagina(async function init() {
  wireReloj();
  wireThemeToggle();
  wireSeasonTheme();
  wireSidebarToggle();
  wireSidebarAccordion();
  await authNav.sync();
  await syncColeccionNavCount();

  if (!(await getSession())) {
    mostrarSolo('mensaje-sesion');
    return;
  }

  const terrario = await cargarTerrario();
  if (!terrario) return;
  wireDetalleTerrario(terrario);
});
