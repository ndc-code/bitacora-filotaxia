import { escapeHtml } from './dom.js';

export function riegosDePlanta(planta) {
  if (planta.riegos && typeof planta.riegos === 'object') return planta.riegos;
  const fallback = planta.riego || '';
  return {
    verano: fallback,
    invierno: fallback,
    primavera: fallback,
    otoño: fallback,
  };
}

export function idDeColeccion(planta) {
  return planta.id || '';
}

/**
 * Fila de tabla para un ítem de colección, con el mismo formato de columnas
 * que el catálogo de Index (Nombre/Especie/Sol/Luminosidad/Riego/Clima/
 * Suelo/Cuidado), reusando las clases `.catalog-row`/`.catalog-riego` para
 * que ambas páginas compartan estilos y el toggle de estación de riego.
 */
export function filaTablaMarkup(planta) {
  const id = escapeHtml(idDeColeccion(planta));
  const nombre = escapeHtml(planta.nombre || '');
  const especie = escapeHtml(planta.especie || '—');
  const sol = escapeHtml(planta.ubicacion || '—');
  const luz = escapeHtml(planta.luz || '—');
  const riego = escapeHtml(planta.riego || '—');
  const clima = escapeHtml(planta.clima || '—');
  const suelo = escapeHtml(planta.suelo || '—');
  const cuidado = escapeHtml(planta.cuidado || '—');

  return `
    <div class="catalog-row" role="row">
      <span><a class="coleccion-tabla-nombre" href="bitacora.html?id=${id}">${nombre}</a></span>
      <span>${especie}</span>
      <span>${sol}</span>
      <span>${luz}</span>
      <span class="catalog-riego">${riego}</span>
      <span>${clima}</span>
      <span>${suelo}</span>
      <span>${cuidado}</span>
      <span class="catalog-cell--action">
        <button
          type="button"
          class="coleccion-eliminar-btn"
          data-id="${id}"
          title="Eliminar de Colección"
          aria-label="Eliminar ${nombre} de Colección"
        >Eliminar</button>
      </span>
    </div>
  `;
}
