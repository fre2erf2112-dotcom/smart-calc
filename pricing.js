/* Все суммы — условные рубли. Замените ставки для своей модели. */
(function (root) {
  'use strict';
  const PRICING = {
    minArea: 20, maxArea: 200, defaultArea: 54,
    types: {
      cosmetic: { name: 'Косметический', work: 4500, materials: 3000, daysPerM2: 0.45, minDays: 14 },
      capital: { name: 'Капитальный', work: 8500, materials: 5500, daysPerM2: 0.8, minDays: 25 },
      designer: { name: 'Дизайнерский', work: 13500, materials: 9000, daysPerM2: 1.2, minDays: 40 }
    },
    options: {
      electrical: { name: 'Электрика', rate: 1800, daysPerM2: 0.12 },
      plumbing: { name: 'Сантехника', rate: 1400, daysPerM2: 0.1 },
      demolition: { name: 'Демонтаж', rate: 900, daysPerM2: 0.08 }
    },
    durationUpperFactor: 1.25
  };
  function calculate(area, type, options = []) {
    if (!Number.isInteger(area) || area < PRICING.minArea || area > PRICING.maxArea) throw new RangeError('Площадь должна быть целым числом от 20 до 200');
    if (!Object.hasOwn(PRICING.types, type)) throw new RangeError('Неизвестный тип ремонта');
    if (!Array.isArray(options) || options.some(key => !Object.hasOwn(PRICING.options, key))) throw new RangeError('Неизвестная опция');
    const selected = [...new Set(options)];
    const base = PRICING.types[type];
    const rows = [
      { name: 'Ремонтные работы', rate: base.work, amount: Math.round(area * base.work) },
      { name: 'Черновые и отделочные материалы', rate: base.materials, amount: Math.round(area * base.materials) },
      ...selected.map(key => ({ name: PRICING.options[key].name, rate: PRICING.options[key].rate, amount: Math.round(area * PRICING.options[key].rate) }))
    ];
    const daysMin = Math.ceil(Math.max(base.minDays, area * base.daysPerM2) + selected.reduce((sum, key) => sum + area * PRICING.options[key].daysPerM2, 0));
    return { area, type, options: selected, rows, total: rows.reduce((sum, row) => sum + row.amount, 0), daysMin, daysMax: Math.ceil(daysMin * PRICING.durationUpperFactor) };
  }
  root.SmartCalc = { PRICING, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SmartCalc;
})(typeof window !== 'undefined' ? window : globalThis);
