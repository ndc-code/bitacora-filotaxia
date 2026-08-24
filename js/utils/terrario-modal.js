import { qs, escapeHtml, showError, clearError } from './dom.js';
import { listarTerrarios, crearTerrario } from '../services/terrarios.js';

const TIPO_LABEL = { abierto: 'Abiertos', cerrado: 'Cerrados' };

function terrarioOpcionMarkup(terrario) {
  return `
    <label class="terrario-opcion">
      <input type="radio" name="terrario-elegido" value="${escapeHtml(terrario.id)}" />
      ${escapeHtml(terrario.nombre)}
    </label>
  `;
}

function renderLista(container, terrarios) {
  const grupos = { abierto: [], cerrado: [] };
  for (const terrario of terrarios) {
    grupos[terrario.tipo]?.push(terrario);
  }

  container.innerHTML = ['abierto', 'cerrado']
    .filter((tipo) => grupos[tipo].length > 0)
    .map(
      (tipo) => `
        <p class="terrario-lista-tipo">${TIPO_LABEL[tipo]}</p>
        ${grupos[tipo].map(terrarioOpcionMarkup).join('')}
      `
    )
    .join('');
}

/**
 * Modal reusado en Index (elegir/crear terrario al agregar un ítem) y
 * Colección (crear un terrario vacío). Mismo patrón que auth-modal.js: un
 * único <dialog> en el HTML de cada página, wireado una vez, reabierto con
 * distinto `modo` según quién lo llame.
 */
export function wireTerrarioModal() {
  const dialog = qs('#dialog-terrario');
  if (!dialog) return { open: async () => {} };

  const errorEl = qs('#error-terrario', dialog);
  const titulo = qs('#titulo-terrario', dialog);
  const listaWrap = qs('#terrario-lista-wrap', dialog);
  const lista = qs('#terrario-lista', dialog);
  const nuevoToggle = qs('#btn-mostrar-nuevo-terrario', dialog);
  const form = qs('#form-nuevo-terrario', dialog);
  const nombreInput = qs('#terrario-nombre', dialog);
  const tipoInput = qs('#terrario-tipo', dialog);
  const submitBtn = qs('#btn-crear-terrario', dialog);
  const closeBtn = qs('.modal-close', dialog);

  let onDone = null;
  let succeeded = false;

  function mostrarFormulario() {
    nuevoToggle.hidden = true;
    form.hidden = false;
  }

  function resetDialog() {
    clearError(errorEl);
    form.reset();
    form.hidden = true;
    nuevoToggle.hidden = false;
    listaWrap.hidden = false;
    lista.innerHTML = '';
  }

  closeBtn?.addEventListener('click', () => dialog.close());
  nuevoToggle.addEventListener('click', mostrarFormulario);

  dialog.addEventListener('close', () => {
    succeeded = false;
    resetDialog();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(errorEl);

    const nombre = nombreInput.value.trim();
    if (!nombre) {
      showError(errorEl, 'Ponele un nombre al terrario.');
      return;
    }

    submitBtn.disabled = true;
    const result = await crearTerrario({ nombre, tipo: tipoInput.value });
    submitBtn.disabled = false;

    if (!result.ok) {
      showError(errorEl, 'No pudimos crear el terrario. Probá otra vez.');
      return;
    }

    const callback = onDone;
    succeeded = true;
    dialog.close();
    if (callback) await callback(result.terrario.id);
  });

  lista.addEventListener('change', async (event) => {
    const input = event.target.closest('input[name="terrario-elegido"]');
    if (!input) return;

    const callback = onDone;
    succeeded = true;
    dialog.close();
    if (callback) await callback(input.value);
  });

  return {
    async open({ modo = 'elegir', onDone: onDoneCallback } = {}) {
      if (dialog.open) return;
      onDone = onDoneCallback ?? null;
      resetDialog();

      if (modo === 'crear') {
        titulo.textContent = 'Nuevo terrario';
        listaWrap.hidden = true;
        mostrarFormulario();
        dialog.showModal();
        return;
      }

      const terrarios = await listarTerrarios();

      if (terrarios.length === 0) {
        titulo.textContent = 'Creá tu primer terrario';
        listaWrap.hidden = true;
        mostrarFormulario();
        dialog.showModal();
        return;
      }

      titulo.textContent = 'Elegí un terrario';
      renderLista(lista, terrarios);
      dialog.showModal();
    },
  };
}
