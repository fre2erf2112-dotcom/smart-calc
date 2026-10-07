/* QA-зависимость нужна только для проверок, веб-продукт работает без неё. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage();
  const errors = [], unexpectedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) unexpectedRequests.push(request.url()); });
  const url = process.env.TEST_URL || 'http://127.0.0.1:8080';
  fs.mkdirSync('qa/screenshots', { recursive: true });
  try {
    await page.goto(url);
    const total = async () => Number((await page.locator('#total').innerText()).replace(/\D/g, ''));
    assert.equal(await total(), 756000);
    for (const area of [20,54,200]) {
      await page.locator('#area-number').fill(String(area));
      for (const [type, rate] of Object.entries({ cosmetic:7500, capital:14000, designer:22500 })) {
        await page.locator(`.type-card:has(input[value="${type}"])`).click();
        for (let mask = 0; mask < 8; mask++) {
          let extras = 0;
          for (const [index, [key, optionRate]] of Object.entries(Object.entries({electrical:1800,plumbing:1400,demolition:900}))) {
            const input = page.locator(`input[value="${key}"]`);
            const checked = Boolean(mask & (1 << Number(index)));
            if (await input.isChecked() !== checked) await page.locator(`.option:has(input[value="${key}"])`).click();
            if (checked) extras += optionRate;
          }
          assert.equal(await total(), area * (rate + extras));
        }
      }
    }
    console.log('PASS: 72 комбинации через интерфейс (3 площади × 3 типа × 8 наборов опций)');
    await page.locator('#reset').click();
    assert.equal(await total(), 756000);
    assert.equal(await page.locator('#area-number').inputValue(), '54');
    assert.equal(await page.locator('input[name="option"]:checked').count(), 0);
    for (const value of ['', '19', '201', '54.5']) {
      await page.locator('#area-number').fill(value);
      assert.equal(await page.locator('#area-number').getAttribute('aria-invalid'), 'true');
      assert.equal(await total(), 756000);
      await page.locator('#calculator-title').click();
      assert.equal(await page.locator('#area-number').inputValue(), '54');
    }
    await page.locator('#area-range').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#area-number').inputValue(), '55');
    assert.equal(await total(), 770000);
    await page.locator('#reset').click();
    await page.locator('#copy').click();
    await page.waitForFunction(() => document.querySelector('#copy-status').textContent === 'Расчёт скопирован');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /756\s000/);
    assert.match(copied, /демонстрационный/);
    console.log('PASS: сброс, валидация площади, клавиатура слайдера, системный буфер обмена');
    await page.locator('#request-button').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'client-name');
    await page.locator('button[type="submit"]').click();
    for (const key of ['name','phone','consent']) assert.equal(await page.locator(`#${key}-error`).isVisible(), true);
    await page.locator('#client-name').fill('1');
    await page.locator('#client-phone').fill('123');
    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('#name-error').isVisible(), true);
    assert.equal(await page.locator('#phone-error').isVisible(), true);
    await page.locator('#client-name').fill('Алексей');
    await page.locator('#client-phone').fill('+7 (999) 123-45-67');
    await page.locator('#demo-consent').check();
    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('#form-success').isVisible(), true);
    assert.equal(await page.locator('#client-phone').inputValue(), '');
    await page.locator('#success-close').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'request-button');
    await page.locator('#request-button').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#request-dialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'request-button');
    await page.locator('#request-button').click();
    await page.locator('#close-dialog').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), ''); // submit button: last focusable in modal
    assert.equal(await page.evaluate(() => document.activeElement.type), 'submit');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'close-dialog');
    await page.keyboard.press('Escape');
    console.log('PASS: ошибки и успех формы, очистка данных, Escape, возврат и удержание фокуса');
    await page.locator('summary').click();
    assert.equal(await page.locator('details').evaluate(el => el.open), true);
    await page.locator('summary').click();
    for (const [width,height] of [[1440,1100],[1024,900],[768,1024],[390,844],[320,720]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => scrollTo(0,0));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `Горизонтальное переполнение: ${width}`);
      await page.screenshot({path:`qa/screenshots/${width}.png`,fullPage:true});
      await page.locator('#request-button').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('button[type="submit"]').isVisible(), true);
      if(width===390) await page.screenshot({path:'qa/screenshots/form-390.png'});
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#area-number').fill('200');
    await page.locator('.type-card:has(input[value="designer"])').click();
    for(const key of ['electrical','plumbing','demolition']) await page.locator(`.option:has(input[value="${key}"])`).click();
    assert.equal(await total(),5320000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:'qa/screenshots/max-390.png',fullPage:true});
    console.log('PASS: адаптация 1440, 1024, 768, 390, 320 px и максимальная смета на смартфоне');
    await page.goto(url);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement.id === 'calculator');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'calculator');
    await page.locator('input[value="capital"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('input[value="designer"]').isChecked(), true);
    await page.locator('input[value="electrical"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('input[value="electrical"]').isChecked(),true);
    console.log('PASS: ссылка пропуска, радио стрелками и опции пробелом');
    const contrastFailures = await page.evaluate(() => {
      const rgb = color => (color.match(/[\d.]+/g) || []).map(Number);
      const luminance = channels => channels.slice(0,3).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i],0);
      return [...document.querySelectorAll('body *')].filter(el => el.getClientRects().length && !el.closest('[aria-hidden="true"], .sr-only, svg') && [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())).flatMap(el => {
        const style = getComputedStyle(el);
        if(style.visibility === 'hidden') return [];
        let parent = el, background;
        while(parent) { const color = rgb(getComputedStyle(parent).backgroundColor); if(color.length === 3 || color[3] === 1) { background = color; break; } parent = parent.parentElement; }
        background ||= [255,255,255];
        const a = luminance(rgb(style.color)), b = luminance(background);
        const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight)>=700);
        return ratio + .01 < (large ? 3 : 4.5) ? [{ text: el.textContent.trim().slice(0,45), ratio: Math.round(ratio*100)/100 }] : [];
      });
    });
    assert.deepEqual(contrastFailures,[], 'Контраст видимого текста');
    console.log('PASS: автоматический расчёт контраста видимого текста (4,5:1 / 3:1 для крупного)');
    assert.deepEqual(errors,[]);
    assert.deepEqual(unexpectedRequests,[]);
    console.log('PASS: нет ошибок JavaScript / console.error и внешних сетевых запросов');
    const filePage = await context.newPage();
    filePage.on('pageerror', error => errors.push(error.message));
    await filePage.goto(require('node:url').pathToFileURL(require('node:path').resolve('index.html')).href);
    assert.equal(Number((await filePage.locator('#total').innerText()).replace(/\D/g,'')),756000);
    await filePage.locator('#area-number').fill('20');
    assert.equal(Number((await filePage.locator('#total').innerText()).replace(/\D/g,'')),280000);
    // Принудительно выключаем Clipboard API, чтобы выполнить резервную ветку.
    await filePage.evaluate(() => Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable:true}));
    await filePage.locator('#copy').click();
    assert.equal(await filePage.locator('#copy-status').innerText(),'Расчёт скопирован');
    await filePage.evaluate(() => { document.execCommand = () => false; });
    await filePage.locator('#copy').click();
    assert.match(await filePage.locator('#copy-status').innerText(),/Браузер запретил/);
    assert.equal(await filePage.locator('textarea').count(),0);
    assert.deepEqual(errors,[]);
    await filePage.close();
    console.log('PASS: запуск file://, резервное копирование и честное сообщение при запрете буфера');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
