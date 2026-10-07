(function () {
  'use strict';
  const { PRICING, calculate } = window.SmartCalc;
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat('ru-RU').format(value);
  const rubles = value => `${money(value)} ₽`;
  const range = $('#area-range'), number = $('#area-number');
  const dialog = $('#request-dialog'), form = $('#request-form');
  let result, announcementTimer, copySequence = 0;
  range.min = number.min = PRICING.minArea;
  range.max = number.max = PRICING.maxArea;
  range.value = number.value = PRICING.defaultArea;
  document.querySelectorAll('[data-price]').forEach(el => {
    const type = PRICING.types[el.dataset.price];
    el.textContent = `${rubles(type.work + type.materials)}/м²`;
  });
  document.querySelectorAll('[data-option-price]').forEach(el => {
    el.textContent = `+${rubles(PRICING.options[el.dataset.optionPrice].rate)}/м²`;
  });
  function update() {
    const type = $('input[name="repair"]:checked').value;
    const options = [...document.querySelectorAll('input[name="option"]:checked')].map(el => el.value);
    result = calculate(Number(range.value), type, options);
    $('#total').textContent = money(result.total);
    $('#result-description').textContent = `${result.area} м² · ${PRICING.types[type].name} ремонт`;
    $('#duration').textContent = `${result.daysMin}–${result.daysMax} дней`;
    $('#breakdown').replaceChildren(...result.rows.map(row => {
      const el = document.createElement('div');
      el.className = 'cost-row';
      const title = document.createElement('span');
      title.className = 'cost-name'; title.textContent = row.name;
      const formula = document.createElement('small');
      formula.textContent = `${result.area} м² × ${rubles(row.rate)}/м²`;
      title.append(formula);
      const amount = document.createElement('span');
      amount.className = 'cost-amount'; amount.textContent = money(row.amount);
      el.append(title, amount); return el;
    }));
    const progress = (result.area - PRICING.minArea) / (PRICING.maxArea - PRICING.minArea) * 100;
    range.style.background = `linear-gradient(to right, #b6cf78 ${progress}%, #edf0e6 ${progress}%)`;
    range.setAttribute('aria-valuetext', `${result.area} квадратных метров`);
    copySequence++;
    $('#copy-status').textContent = '';
    clearTimeout(announcementTimer);
    announcementTimer = setTimeout(() => {
      $('#calculation-status').textContent = `Расчёт: ${rubles(result.total)}. Срок ${result.daysMin}–${result.daysMax} дней.`;
    }, 350);
  }
  function setAreaValidity(valid) {
    $('#area-error').hidden = valid;
    number.setAttribute('aria-invalid', String(!valid));
  }
  number.addEventListener('input', () => {
    const value = number.valueAsNumber;
    const valid = Number.isInteger(value) && value >= PRICING.minArea && value <= PRICING.maxArea;
    setAreaValidity(valid);
    if (valid) { range.value = value; update(); }
  });
  number.addEventListener('blur', () => {
    if (number.getAttribute('aria-invalid') === 'true') {
      number.value = range.value;
      setAreaValidity(true);
    }
  });
  range.addEventListener('input', () => { number.value = range.value; setAreaValidity(true); update(); });
  document.querySelectorAll('input[name="repair"], input[name="option"]').forEach(el => el.addEventListener('change', update));
  $('#reset').addEventListener('click', () => {
    range.value = number.value = PRICING.defaultArea;
    $('input[name="repair"][value="capital"]').checked = true;
    document.querySelectorAll('input[name="option"]').forEach(el => { el.checked = false; });
    setAreaValidity(true); update();
    $('#calculation-status').textContent = 'Параметры сброшены.';
  });
  function resultText() {
    return ['SMART CALC — демонстрационный расчёт', `${result.area} м² · ${PRICING.types[result.type].name} ремонт`, ...result.rows.map(row => `${row.name}: ${result.area} м² × ${rubles(row.rate)}/м² = ${rubles(row.amount)}`), `Итого: ${rubles(result.total)}`, `Ориентировочный срок: ${result.daysMin}–${result.daysMax} дней`, 'Все цены условные. Расчёт ориентировочный и не является коммерческим предложением.'].join('\n');
  }
  $('#copy').addEventListener('click', async () => {
    const text = resultText(), sequence = ++copySequence;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const temporary = document.createElement('textarea');
        temporary.value = text;
        temporary.setAttribute('aria-label', 'Текст расчёта для копирования');
        temporary.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
        document.body.append(temporary);
        temporary.select();
        let success;
        try { success = document.execCommand('copy'); } finally { temporary.remove(); $('#copy').focus(); }
        if (!success) throw new Error('Clipboard unavailable');
      }
      if (sequence === copySequence) $('#copy-status').textContent = 'Расчёт скопирован';
    } catch {
      if (sequence === copySequence) $('#copy-status').textContent = 'Браузер запретил копирование. Разрешите доступ к буферу обмена и повторите.';
    }
  });
  function clearForm() {
    form.reset();
    ['name','phone','consent'].forEach(key => { $(`#${key}-error`).hidden = true; });
    [$('#client-name'), $('#client-phone'), $('#demo-consent')].forEach(el => el.removeAttribute('aria-invalid'));
  }
  $('#request-button').addEventListener('click', () => {
    clearForm(); $('#form-content').hidden = false; $('#form-success').hidden = true;
    $('#form-estimate').textContent = `${result.area} м² · ${PRICING.types[result.type].name} · ${rubles(result.total)}`;
    dialog.showModal();
    $('#client-name').focus();
  });
  $('#close-dialog').addEventListener('click', () => dialog.close());
  $('#success-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, input, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => { clearForm(); $('#request-button').focus(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#client-name'), phone = $('#client-phone'), consent = $('#demo-consent');
    const digits = phone.value.replace(/\D/g, '');
    const errors = [
      { field: name, error: $('#name-error'), valid: /^[\p{L}][\p{L}\s’'-]{1,59}$/u.test(name.value.trim()), message: 'Введите имя от 2 до 60 символов: буквы, пробел, апостроф или дефис.' },
      { field: phone, error: $('#phone-error'), valid: /^[+\d\s()-]+$/.test(phone.value) && (digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits))), message: 'Введите 10 цифр номера или 11 цифр с кодом 7 / 8.' },
      { field: consent, error: $('#consent-error'), valid: consent.checked, message: 'Подтвердите, что это демонстрационная форма.' }
    ];
    errors.forEach(({field, error, valid, message}) => { field.setAttribute('aria-invalid', String(!valid)); error.hidden = valid; error.textContent = message; });
    const first = errors.find(item => !item.valid);
    if (first) first.field.focus();
    else { clearForm(); $('#form-content').hidden = true; $('#form-success').hidden = false; $('#success-close').focus(); }
  });
  [$('#client-name'), $('#client-phone'), $('#demo-consent')].forEach(el => el.addEventListener('input', () => {
    el.removeAttribute('aria-invalid');
    const key = el.id === 'client-name' ? 'name' : el.id === 'client-phone' ? 'phone' : 'consent';
    $(`#${key}-error`).hidden = true;
  }));
  update();
})();
