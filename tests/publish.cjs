/* Проверяет Pages-подпапку на локальном статическом сервере, ничего не публикует. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const files = ['index.html', 'styles.css', 'pricing.js', 'app.js', 'favicon.svg', '.nojekyll'];
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' };

(async () => {
  for (const file of files) assert.ok(fs.statSync(path.join(root,file)).isFile());
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const ref of refs) {
    assert.ok(!/^(?:\/|[a-z]+:)/i.test(ref), `Неотносительный путь: ${ref}`);
    if (!ref.startsWith('#')) assert.ok(files.includes(ref), `Нет ресурса: ${ref}`);
  }
  assert.equal(fs.readFileSync(path.join(root,'.nojekyll'),'utf8'),'');
  console.log('PASS: все ссылки страницы относительные, ресурсы существуют, .nojekyll готов');
  const server = http.createServer((request,response) => {
    const pathname = new URL(request.url,'http://localhost').pathname;
    const name = pathname === '/smart-calc/' ? 'index.html' : pathname.replace(/^\/smart-calc\//,'');
    if(request.method !== 'GET' || !pathname.startsWith('/smart-calc/') || !files.includes(name)) {
      response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, {'Content-Type':types[path.extname(name)] || 'text/plain'});
    response.end(fs.readFileSync(path.join(root,name)));
  });
  let browser;
  try {
    await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('console',message => { if(message.type() === 'error') errors.push(message.text()); });
    page.on('request',request => requests.push({url:request.url(),method:request.method(),body:request.postData()}));
    const response = await page.goto(`${origin}/smart-calc/`);
    assert.equal(response.status(),200);
    assert.equal(await page.locator('#total').innerText(),'756\u00a0000');
    assert.ok(await page.locator('.result-panel').evaluate(el => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'));
    await page.locator('#area-number').fill('200');
    assert.equal((await page.locator('#total').innerText()).replace(/\D/g,''),'2800000');
    await page.locator('#reset').click();
    assert.equal((await page.locator('#total').innerText()).replace(/\D/g,''),'756000');
    await page.locator('.lab-link').click();
    assert.equal(page.url(),`${origin}/smart-calc/#about`);
    await page.reload();
    assert.equal((await page.locator('#total').innerText()).replace(/\D/g,''),'756000');
    const beforeSubmit = requests.length;
    await page.locator('#request-button').click();
    await page.locator('#client-name').fill('Демо');
    await page.locator('#client-phone').fill('+7 (999) 123-45-67');
    await page.locator('#demo-consent').check();
    await page.locator('button[type="submit"]').click();
    assert.equal(await page.locator('#form-success').isVisible(),true);
    assert.equal(await page.locator('#client-name').inputValue(),'');
    assert.equal(await page.locator('#client-phone').inputValue(),'');
    assert.equal(requests.length,beforeSubmit);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length),0);
    for(const request of requests) {
      assert.equal(request.method,'GET');
      assert.equal(request.body,null);
      const url = new URL(request.url);
      assert.equal(url.origin,origin);
      assert.equal(url.search,'');
      assert.ok(url.pathname.startsWith('/smart-calc/'));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: статическая подпапка /smart-calc/, CSS и JS, смета, сброс, якорь и перезагрузка');
    console.log('PASS: форма не отправляет данные, поля очищаются, localStorage/sessionStorage пусты');
    console.log('PASS: только локальные GET-запросы ресурсов без параметров и тела, нет ошибок JS');
  } finally {
    if(browser) await browser.close();
    if(server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode=1; });
