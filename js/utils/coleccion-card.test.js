import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDeColeccion, riegosDePlanta } from './coleccion-card.js';

test('idDeColeccion usa el uuid de la fila, no planta_id (permite ítems repetidos)', () => {
  const planta = {
    id: '11111111-1111-4111-8111-111111111111',
    planta_id: 'aglaonema::aglaonema commutatum::sombra',
  };
  assert.equal(idDeColeccion(planta), '11111111-1111-4111-8111-111111111111');
});

test('idDeColeccion sin id de fila devuelve vacío en vez de romper', () => {
  assert.equal(idDeColeccion({}), '');
});

test('riegosDePlanta devuelve el objeto de riegos si ya viene armado', () => {
  const riegos = { verano: 'Cada 7 días', invierno: 'Cada 14 días', primavera: 'Cada 10 días', otoño: 'Cada 10 días' };
  assert.deepEqual(riegosDePlanta({ riegos }), riegos);
});

test('riegosDePlanta arma las 4 estaciones a partir de un riego único', () => {
  const resultado = riegosDePlanta({ riego: 'Cada 10 días' });
  assert.deepEqual(resultado, {
    verano: 'Cada 10 días',
    invierno: 'Cada 10 días',
    primavera: 'Cada 10 días',
    otoño: 'Cada 10 días',
  });
});
