'use strict';

(async function unlock() {
  const status = document.getElementById('status');
  const encodedKey = new URLSearchParams(location.hash.slice(1)).get('key');
  if (!encodedKey) return;
  if (!/^[A-Za-z0-9_-]{43}$/.test(encodedKey)) {
    status.textContent = '링크가 완전하지 않아요. 받은 링크 전체를 다시 열어 주세요.';
    return;
  }
  if (!globalThis.crypto?.subtle || !globalThis.DecompressionStream) {
    status.textContent = '이 페이지를 열려면 최신 Chrome, Edge 또는 Safari가 필요해요.';
    return;
  }
  status.textContent = '페이지를 여는 중이에요…';
  try {
    const rawKey = Uint8Array.from(atob(encodedKey.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const response = await fetch('./payload.bin', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Unavailable');
    const payload = new Uint8Array(await response.arrayBuffer());
    if (payload.length < 33 || new TextDecoder().decode(payload.slice(0, 4)) !== 'SNV1') throw new Error('Invalid payload');
    const compressed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(4, 16) }, key, payload.slice(16));
    const html = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const frame = document.createElement('iframe');
    frame.title = '벚꽃이 지기 전에';
    frame.referrerPolicy = 'no-referrer';
    // This trusted, authenticated document uses same-origin storage for local saves.
    frame.srcdoc = html;
    document.body.append(frame);
    document.getElementById('gate').remove();
    document.title = '벚꽃이 지기 전에';
  } catch {
    status.textContent = '페이지를 열 수 없어요. 받은 링크 전체와 인터넷 연결을 확인한 뒤 새로고침해 주세요.';
  }
})();
