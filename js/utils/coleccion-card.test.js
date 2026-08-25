import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filaTablaMarkup } from './coleccion-card.js';

function plantaCard(extra = {}) {
  return {
    nombre: 'Aglaonema',
    especie: 'Aglaonema commutatum',
    ubicacion: 'Sombra',
    luz: 'Baja',
    suelo: 'Franco',
    cuidado: 'Fácil',
    clima: 'Templado',
    riego: 'Cada 10 días',
    ...extra,
  };
}

test('la fila muestra el nombre de la planta como link a su bitácora', () => {
  const html = filaTablaMarkup(plantaCard());
  assert.match(html, /class="coleccion-tabla-nombre" href="bitacora.html\?id="/);
  assert.match(html, />Aglaonema</);
});

test('el link de la fila apunta a la bitácora de la planta por uuid', () => {
  const html = filaTablaMarkup(
    plantaCard({ id: '11111111-1111-4111-8111-111111111111' })
  );
  assert.match(html, /href="bitacora.html\?id=11111111-1111-4111-8111-111111111111"/);
});

test('la fila muestra especie, sol, luz, riego, clima, suelo y cuidado en sus columnas', () => {
  const html = filaTablaMarkup(plantaCard());
  assert.match(html, />Aglaonema commutatum</);
  assert.match(html, />Sombra</);
  assert.match(html, />Baja</);
  assert.match(html, /class="catalog-riego">Cada 10 días</);
  assert.match(html, />Templado</);
  assert.match(html, />Franco</);
  assert.match(html, />Fácil</);
});

test('atributos faltantes se muestran como "—" en vez de vacíos o undefined', () => {
  const html = filaTablaMarkup({ nombre: 'Pómez' });
  assert.doesNotMatch(html, /undefined/);
  assert.match(html, />—</);
});

test('Eliminar usa el uuid de la fila, no planta_id (permite ítems repetidos)', () => {
  const html = filaTablaMarkup(
    plantaCard({
      id: '11111111-1111-4111-8111-111111111111',
      planta_id: 'aglaonema::aglaonema commutatum::sombra',
    })
  );
  assert.match(html, /data-id="11111111-1111-4111-8111-111111111111"/);
  assert.doesNotMatch(html, /data-id="aglaonema/);
});
