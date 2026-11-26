import './preferences.js';
import './dates.js';
import './i18n.js';

export const { MAX_DAYS, settingsKeys, readPreferences } = globalThis.scwvPreferences;
const { tradingDay, dateRange } = globalThis.scwvDates;
const { languages, uiLanguage, direction, loadCatalog, translator } = globalThis.scwvI18n;
const browserLanguage = chrome.i18n.getUILanguage();

export let language;
export let text;

export function patchSettings(changes) {
  return navigator.locks.request('warehouse-vwap:quote-settings', async () => {
    const { quoteSettings } = await chrome.storage.local.get('quoteSettings');
    await chrome.storage.local.set({ quoteSettings: { ...quoteSettings, ...changes } });
  });
}

export function onSave(form, save) {
  const notice = form.querySelector('output');
  form.addEventListener('input', () => setNotice(notice));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await save(form.elements);
      setNotice(notice, 'saved');
    } catch {
      setNotice(notice, 'saveFailed');
    }
  });
}

export function setNotice(output, message) {
  if (message) output.dataset.message = message;
  else delete output.dataset.message;
  output.textContent = message ? text(message) : '';
}

async function localize(preference) {
  const nextLanguage = uiLanguage(preference, browserLanguage);
  if (language === nextLanguage) return;
  const messages = await loadCatalog(nextLanguage);
  if (nextLanguage !== uiLanguage(readPreferences(stored).language, browserLanguage)) return;
  language = nextLanguage;
  text = translator(messages);
  document.documentElement.lang = language;
  document.documentElement.dir = direction(language);
  for (const element of document.querySelectorAll('[data-message]')) {
    element.textContent = text(element.dataset.message);
  }
  for (const element of document.querySelectorAll('[data-placeholder]')) {
    element.placeholder = text(element.dataset.placeholder);
  }
  for (const element of document.querySelectorAll('[data-label]')) {
    element.setAttribute('aria-label', text(element.dataset.label));
  }
  document.dispatchEvent(new Event('warehouse-vwap:language'));
}

const form = document.querySelector('#defaults');
const { discount, days } = form.elements;
const preview = document.querySelector('#period-preview');
const languageControl = document.querySelector('#language');
const defaultsKeys = ['discount', 'quoteSettings'];
const stored = await chrome.storage.local.get(defaultsKeys);
let periodTimer;
days.max = MAX_DAYS;
if (languageControl) {
  for (const [tag, name] of Object.entries(languages)) {
    const option = new Option(name, tag);
    option.lang = tag;
    option.dir = direction(tag);
    languageControl.add(option);
  }
}

function renderPeriod() {
  if (!text) return;
  const { date, nextDay } = tradingDay();
  const count = days.valueAsNumber;
  if (days.validity.valid) {
    const label = count === 1 ? 'periodOne' : count === 2 ? 'periodTwo' : 'periodMany';
    preview.textContent = text(label, dateRange(date, count), count);
  } else {
    preview.textContent = '';
  }
  clearTimeout(periodTimer);
  periodTimer = setTimeout(renderPeriod, Math.max(1, nextDay - Date.now()));
}

async function loadDefaults() {
  const preferences = readPreferences(stored);
  for (const input of [discount, days]) {
    const value = String(preferences[input.name]);
    if (input.value === input.defaultValue) input.value = value;
    input.defaultValue = value;
  }
  if (languageControl) {
    languageControl.value = Object.hasOwn(languages, preferences.language) ? preferences.language : 'auto';
  }
  document.documentElement.dataset.theme = preferences.theme;
  await localize(preferences.language);
  renderPeriod();
}

await loadDefaults();
days.addEventListener('input', renderPeriod);
onSave(form, ({ discount, days }) => patchSettings({
  discount: discount.valueAsNumber,
  days: days.valueAsNumber,
}));

languageControl?.addEventListener('change', async () => {
  const notice = document.querySelector('#language-notice');
  setNotice(notice);
  try {
    await patchSettings({ language: languageControl.value });
  } catch {
    languageControl.value = readPreferences(stored).language;
    setNotice(notice, 'saveFailed');
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !defaultsKeys.some(key => Object.hasOwn(changes, key))) return;
  for (const key of defaultsKeys) {
    if (changes[key]) stored[key] = changes[key].newValue;
  }
  void loadDefaults();
});
