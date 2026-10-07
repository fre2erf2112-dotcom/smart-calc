const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PRICING, calculate } = require('../pricing.js');

test('Исходный расчёт: 54 м², капитальный ремонт', () => {
  const value = calculate(54, 'capital');
  assert.equal(value.total, 756000);
  assert.deepEqual(value.rows.map(row => row.amount), [459000, 297000]);
  assert.equal(value.daysMin, 44);
  assert.equal(value.daysMax, 55);
});

test('Все 4344 комбинации целой площади, типов и опций', () => {
  const keys = Object.keys(PRICING.options);
  let count = 0;
  for (let area = 20; area <= 200; area++) {
    for (const type of Object.keys(PRICING.types)) {
      for (let mask = 0; mask < 8; mask++) {
        const options = keys.filter((_, index) => mask & (1 << index));
        const result = calculate(area, type, options);
        // Независимые ожидаемые ставки, чтобы изменение модели не прошло незаметно.
        const baseRates = { cosmetic: 7500, capital: 14000, designer: 22500 };
        const optionRates = { electrical: 1800, plumbing: 1400, demolition: 900 };
        assert.equal(result.total, area * (baseRates[type] + options.reduce((sum, key) => sum + optionRates[key], 0)));
        assert.equal(result.rows.reduce((sum, row) => sum + row.amount, 0), result.total);
        assert.ok(Number.isInteger(result.total));
        assert.ok(Number.isInteger(result.daysMin) && result.daysMin > 0);
        assert.equal(result.daysMax, Math.ceil(result.daysMin * 1.25));
        if (area > 20) {
          const previous = calculate(area - 1, type, options);
          assert.ok(result.total > previous.total);
          assert.ok(result.daysMin >= previous.daysMin);
        }
        count++;
      }
    }
  }
  assert.equal(count, 4344);
});

test('Границы и округление сроков', () => {
  assert.equal(calculate(20, 'cosmetic').total, 150000);
  const max = calculate(200, 'designer', ['electrical', 'plumbing', 'demolition']);
  assert.equal(max.total, 5320000);
  assert.equal(max.daysMin, 300);
  assert.equal(max.daysMax, 375);
  assert.equal(calculate(20, 'cosmetic').daysMin, 14);
  assert.equal(calculate(20, 'cosmetic').daysMax, 18);
  assert.equal(calculate(54, 'capital', ['electrical']).daysMin, 50);
  assert.equal(calculate(54, 'capital', ['electrical']).daysMax, 63);
});

test('Невалидные параметры отклоняются, повторные опции не удваивают стоимость', () => {
  for (const area of [19, 201, 20.5, NaN, Infinity, '54', null]) assert.throws(() => calculate(area, 'capital'), RangeError);
  for (const type of ['unknown', 'toString', '__proto__']) assert.throws(() => calculate(54, type), RangeError);
  assert.throws(() => calculate(54, 'capital', ['unknown']), RangeError);
  assert.throws(() => calculate(54, 'capital', 'electrical'), RangeError);
  assert.equal(calculate(54, 'capital', ['electrical', 'electrical']).total, calculate(54, 'capital', ['electrical']).total);
});
