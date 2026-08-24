import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriaDe } from './catalog-categorias.js';

test('categoriaDe resuelve Suculentas por nombre y especie', () => {
  assert.equal(
    categoriaDe({ nombre: 'Haworthia cebra', especie: 'Haworthia attenuata' }),
    'Suculentas'
  );
});

test('categoriaDe distingue categorías distintas por especie', () => {
  assert.equal(
    categoriaDe({ nombre: 'Musgo de Java', especie: 'Taxiphyllum barbieri' }),
    'Musgo'
  );
  assert.equal(
    categoriaDe({ nombre: 'Colémbolo blanco', especie: 'Folsomia candida' }),
    'Colémbolos'
  );
});

test('categoriaDe resuelve por planta_id cuando hay id de catálogo', () => {
  assert.equal(
    categoriaDe({ planta_id: 'haworthia cebra::haworthia attenuata::haworthia-cebra-haworthia-attenuata' }),
    'Suculentas'
  );
});

test('categoriaDe usa la categoría ya guardada si viene en la planta', () => {
  assert.equal(
    categoriaDe({ nombre: 'X', categoria: 'Arbustos' }),
    'Arbustos'
  );
});

test('categoriaDe devuelve raya si no hay match', () => {
  assert.equal(categoriaDe({ nombre: 'Planta inventada', especie: 'Nada' }), '—');
});
