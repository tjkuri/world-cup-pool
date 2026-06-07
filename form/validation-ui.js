import { getState } from './state.js';

let summaryEl = null;

export function initValidationUI(rootEl) {
  summaryEl = document.createElement('div');
  summaryEl.className = 'error-summary';
  summaryEl.hidden = true;
  rootEl.insertBefore(summaryEl, rootEl.firstChild);
}

export function renderValidationUI() {
  if (!summaryEl) return;
  const { errors } = getState();
  if (!errors.length) {
    summaryEl.hidden = true;
    summaryEl.innerHTML = '';
    return;
  }
  summaryEl.hidden = false;
  summaryEl.innerHTML = '';
  const heading = document.createElement('strong');
  heading.textContent = `Please fix ${errors.length} problem${errors.length === 1 ? '' : 's'} before submitting:`;
  summaryEl.appendChild(heading);
  const list = document.createElement('ul');
  for (const err of errors) {
    const item = document.createElement('li');
    item.textContent = err.message;
    list.appendChild(item);
  }
  summaryEl.appendChild(list);
}
