(function () {
  const faces = window.astrolabeFaces || [];
  const grid = document.getElementById('faces');
  const dialog = document.getElementById('face-dialog');
  const detail = document.getElementById('face-detail');
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  let activeFilter = 'all';

  function faceImage(face) {
    return (face.image || '').replace('../assets/faces/', '../assets/faces/');
  }

  function renderFaceVisual(face) {
    const image = faceImage(face);
    if (!image) {
      return `<span class="face-placeholder">${escapeHtml(face.title)}</span>`;
    }
    return `<img src="${escapeHtml(image)}" alt="${escapeHtml(face.title)} face" loading="lazy" />`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function matchesFilter(face) {
    return activeFilter === 'all' || face.variant === activeFilter;
  }

  function render() {
    const visible = faces.filter(matchesFilter);
    grid.innerHTML = visible.map((face, index) => `
      <article class="face-card">
        <button data-face-index="${index}" data-face-slug="${escapeHtml(face.slug)}">
          ${renderFaceVisual(face)}
          <span>${escapeHtml(face.kicker || face.variant || 'Astrolabe')}</span>
          <strong>${escapeHtml(face.title)}</strong>
          <small>${escapeHtml(face.summary)}</small>
        </button>
      </article>
    `).join('');
  }

  function openFace(slug) {
    const face = faces.find((item) => item.slug === slug);
    if (!face) return;
    detail.innerHTML = `
      <div class="detail-layout">
        ${faceImage(face)
          ? `<img src="${escapeHtml(faceImage(face))}" alt="${escapeHtml(face.title)} face preview" />`
          : `<span class="face-placeholder face-placeholder--large">${escapeHtml(face.title)}</span>`}
        <div>
          <p class="eyebrow">${escapeHtml(face.kicker || face.variant || 'Astrolabe')}</p>
          <h2>${escapeHtml(face.title)}</h2>
          <p>${escapeHtml(face.summary)}</p>
          <h3>Inquiry</h3>
          <p>${escapeHtml(face.inquiry)}</p>
          <h3>Use</h3>
          <ul>${(face.use || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          <h3>Interactions</h3>
          <p>${escapeHtml(face.interactions)}</p>
        </div>
      </div>
    `;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      buttons.forEach((item) => item.classList.toggle('is-active', item === button));
      render();
    });
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-face-slug]');
    if (!button) return;
    openFace(button.dataset.faceSlug);
  });

  document.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  render();
})();
