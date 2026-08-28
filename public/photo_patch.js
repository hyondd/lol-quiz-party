// Real-photo renderer for タイトル学園.
// Loaded after app.js so it replaces the original emoji scene-card renderer.
makeSceneCard = function makeSceneCardWithPhoto(scene, compact = false) {
  const card = document.createElement('div');
  card.className = `scene-card ${compact ? 'compact' : ''}`;

  // Keep the paper-card look, but give real photos enough room.
  card.style.padding = compact ? '34px 14px 14px' : '42px 16px 16px';
  card.style.minHeight = compact ? '220px' : '390px';
  card.style.alignContent = 'stretch';

  const tape = document.createElement('div');
  tape.className = 'scene-tape';
  tape.textContent = '実写お題';
  card.appendChild(tape);

  if (scene?.image) {
    const frame = document.createElement('div');
    frame.style.width = '100%';
    frame.style.display = 'grid';
    frame.style.placeItems = 'center';
    frame.style.overflow = 'hidden';
    frame.style.borderRadius = '6px';
    frame.style.background = '#ddd8c8';
    frame.style.minHeight = compact ? '160px' : '290px';

    const img = document.createElement('img');
    img.src = scene.image;
    img.alt = 'タイトルをつけるためのお題写真';
    img.loading = 'eager';
    img.referrerPolicy = 'no-referrer';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = compact ? '220px' : '360px';
    img.style.objectFit = 'contain';
    img.style.background = '#ddd8c8';

    const fallback = document.createElement('div');
    fallback.textContent = '画像を読み込めませんでした';
    fallback.style.display = 'none';
    fallback.style.padding = '50px 16px';
    fallback.style.fontWeight = '900';
    fallback.style.color = '#555';

    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'block';
    };

    frame.append(img, fallback);
    card.appendChild(frame);

    if (scene.credit) {
      const credit = document.createElement(scene.source ? 'a' : 'div');
      credit.textContent = `Photo: ${scene.credit}`;
      credit.style.marginTop = '9px';
      credit.style.fontSize = '10px';
      credit.style.lineHeight = '1.4';
      credit.style.color = '#5d5a50';
      credit.style.textDecoration = 'none';
      credit.style.zIndex = '2';
      if (scene.source) {
        credit.href = scene.source;
        credit.target = '_blank';
        credit.rel = 'noopener noreferrer';
      }
      card.appendChild(credit);
    }
  } else {
    const art = document.createElement('div');
    art.className = 'scene-art';
    art.textContent = scene?.art || '？';
    card.appendChild(art);

    if (scene?.detail) {
      const detail = document.createElement('div');
      detail.className = 'scene-detail';
      detail.textContent = scene.detail;
      card.appendChild(detail);
    }
  }

  return card;
};
