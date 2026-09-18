const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto, randomBytes } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { JSDOM } = require('jsdom');

const folder = path.join(__dirname, '../public/sakura');
const shell = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(folder, 'unlock.js'), 'utf8');

async function fixture(fragment, payload) {
  let requests = 0;
  const dom = new JSDOM(shell, { url: 'https://example.test/sakura/' + fragment, runScripts: 'outside-only' });
  const win = dom.window;
  Object.defineProperty(win, 'crypto', { value: webcrypto });
  Object.assign(win, { TextDecoder, Response, Blob, DecompressionStream });
  win.fetch = async () => { requests++; return new Response(payload); };
  await win.eval(loader);
  return { dom, requests, document: win.document };
}

test('old links and missing keys cannot load the private content', async () => {
  const result = await fixture('', Buffer.from('unavailable'));
  assert.equal(result.requests, 0);
  assert.equal(result.document.querySelector('iframe'), null);
  assert.match(result.document.getElementById('status').textContent, /전체/);
  result.dom.window.close();
  const homepage = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const korean = fs.readFileSync(path.join(__dirname, '../public/korean/index.html'), 'utf8');
  assert.doesNotMatch(homepage + korean, /sakura\//);
});

test('only the correct fragment key decrypts an authenticated payload', async () => {
  const rawKey = randomBytes(32), iv = randomBytes(12);
  const key = await webcrypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const html = '<!doctype html><html lang="ko"><body>테스트 페이지</body></html>';
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, gzipSync(html));
  const payload = Buffer.concat([Buffer.from('SNV1'), iv, Buffer.from(ciphertext)]);
  const success = await fixture('#key=' + rawKey.toString('base64url'), payload);
  assert.equal(success.document.querySelector('iframe').srcdoc, html);
  assert.equal(success.document.getElementById('gate'), null);
  success.dom.window.close();
  const failure = await fixture('#key=' + randomBytes(32).toString('base64url'), payload);
  assert.equal(failure.document.querySelector('iframe'), null);
  assert.match(failure.document.getElementById('status').textContent, /열 수 없어요/);
  failure.dom.window.close();
  payload[payload.length - 1] ^= 1;
  const tampered = await fixture('#key=' + rawKey.toString('base64url'), payload);
  assert.equal(tampered.document.querySelector('iframe'), null);
  tampered.dom.window.close();
});
