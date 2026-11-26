import './preferences.js';

export const { MAX_DAYS, settingsKeys, readPreferences } = globalThis.scwvPreferences;

export function patchSettings(changes) {
  return navigator.locks.request('warehouse-vwap:quote-settings', async () => {
    const { quoteSettings } = await chrome.storage.local.get('quoteSettings');
    await chrome.storage.local.set({ quoteSettings: { ...quoteSettings, ...changes } });
  });
}

export function onSave(form, save) {
  const notice = form.querySelector('output');
  form.addEventListener('input', () => { notice.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await save(form.elements);
      notice.textContent = '已保存';
    } catch {
      notice.textContent = '保存失败';
    }
  });
}

const form = document.querySelector('#defaults');
const { discount, days } = form.elements;
days.max = MAX_DAYS;

async function loadDefaults() {
  const preferences = readPreferences(await chrome.storage.local.get(['discount', 'quoteSettings']));
  for (const input of [discount, days]) {
    const value = String(preferences[input.name]);
    if (input.value === input.defaultValue) input.value = value;
    input.defaultValue = value;
  }
  document.documentElement.dataset.theme = preferences.theme;
}

await loadDefaults();
onSave(form, ({ discount, days }) => patchSettings({
  discount: discount.valueAsNumber,
  days: days.valueAsNumber,
}));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.quoteSettings || changes.discount)) void loadDefaults();
});
