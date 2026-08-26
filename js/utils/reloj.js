import { qsa } from './dom.js';
import { estacionElegida } from './catalog-season-theme.js';

/**
 * El cartel dice "Buenos Aires, ARG", así que la hora es siempre la de Buenos
 * Aires: quien entre desde otro huso ve la misma que acá, y la etiqueta nunca
 * miente. Por eso el huso es fijo y no `undefined` (hora local del dispositivo).
 */
export const ZONA = 'America/Argentina/Buenos_Aires';

const LOCALE = 'es-AR';

// Dos formatters en vez de uno: pedirle fecha y hora juntos a `Intl` devuelve
// "13 ago, 23:46", y esa coma choca con la de "Buenos Aires, ARG".
const formatoFecha = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: ZONA,
});

const formatoMes = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: ZONA });

// Hora y fecha larga van separadas (no en un solo formatter) para poder
// armar "00:18 ART 26 Agosto 2026" a mano, sin las comas ni el "de" que
// mete `Intl` cuando le pedís todo junto.
const formatoHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

const formatoFechaLarga = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function partesPor(date, formatter) {
  return Object.fromEntries(formatter.formatToParts(date).map((parte) => [parte.type, parte.value]));
}

// Estaciones meteorológicas del hemisferio sur, agrupadas por mes calendario
// (índice 0 = enero ... 11 = diciembre) en vez de por fecha exacta de
// equinoccio/solsticio — más simple y es como la gente las nombra.
const ESTACIONES = [
  'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno',
  'Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano',
];

function estacionDe(date) {
  const mes = Number(formatoMes.format(date));
  return ESTACIONES[mes - 1];
}

/**
 * Devuelve la fecha y estación de Buenos Aires como "13 ago Invierno".
 */
export function formatearFechaEstacion(date = new Date()) {
  return `${formatoFecha.format(date)} ${estacionDe(date)}`;
}

export function formatearEstacion(date = new Date()) {
  return estacionDe(date);
}

/**
 * Devuelve hora, huso y fecha larga como "00:18 ART 26 Agosto 2026".
 */
export function formatearHoraCompleta(date = new Date()) {
  const { hour, minute, timeZoneName } = partesPor(date, formatoHora);
  const { day, month, year } = partesPor(date, formatoFechaLarga);
  const mes = month.charAt(0).toUpperCase() + month.slice(1);
  return `${hour}:${minute} ${timeZoneName} ${day} ${mes} ${year}`;
}

/**
 * Milisegundos que faltan para el próximo minuto redondo. Se reprograma con
 * este valor en vez de un intervalo fijo de 60s para que el reloj cambie cuando
 * cambia el minuto real, y no con el desfase que tuviera al cargar la página.
 */
export function msHastaProximoMinuto(date = new Date()) {
  return 60000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}

/**
 * Mantiene en hora todos los `[data-hora-completa]`/`[data-estacion-tema]` de
 * la página (hora+fecha larga en el header y el sidebar; la estación va sola
 * junto a "Noche"). Devuelve una función para frenarlo.
 *
 * `[data-estacion-tema]` y no `[data-estacion]`: ese otro atributo ya lo usa
 * `.catalog-riego-toggle` para guardar su propio estado (la estación de
 * riego elegida), y matchearlo acá le pisaría el texto.
 */
export function wireReloj() {
  const horasCompletas = qsa('[data-hora-completa]');
  const estaciones = qsa('[data-estacion-tema]');
  if (!horasCompletas.length && !estaciones.length) return () => {};

  let timer = null;

  function pintar() {
    const ahora = new Date();
    // `datetime` legible por máquinas; el texto visible ya está en hora de
    // Buenos Aires, así que acá va el instante exacto en ISO.
    const marcarInstante = (el) => {
      if (el.tagName === 'TIME') el.setAttribute('datetime', ahora.toISOString());
    };

    horasCompletas.forEach((el) => {
      el.textContent = formatearHoraCompleta(ahora);
      marcarInstante(el);
    });
    // Si el usuario ya tocó el botón de estación para cambiar el tema, esa
    // elección manual manda sobre la real hasta que la vuelva a tocar.
    estaciones.forEach((el) => {
      el.textContent = estacionElegida() ?? formatearEstacion(ahora);
    });

    timer = setTimeout(pintar, msHastaProximoMinuto(ahora));
  }

  pintar();

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
