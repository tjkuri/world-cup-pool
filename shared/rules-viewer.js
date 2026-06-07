export function initRulesViewer({ triggerEl, overlayEl }) {
  if (!triggerEl || !overlayEl) return;
  triggerEl.addEventListener('click', async () => {
    if (!overlayEl.dataset.loaded) {
      const html = await fetch('./shared/rules.html').then(r => r.text());
      overlayEl.innerHTML = `
        <div class="rules-drawer">
          <button type="button" class="close" aria-label="Close">×</button>
          ${html}
        </div>
      `;
      overlayEl.dataset.loaded = '1';
      overlayEl.querySelector('.close').addEventListener('click', close);
      overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
    overlayEl.hidden = false;
  });

  function close() { overlayEl.hidden = true; }
}
