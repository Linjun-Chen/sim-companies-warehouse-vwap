import { MAX_DAYS, settingsKeys, readPreferences, patchSettings, onSave, setNotice, language, text } from './defaults.js';
import './product-names.js';

const productNames = globalThis.scwvProductNames;
const { patchProductRules } = globalThis.scwvPreferences;
const find = selector => document.querySelector(selector);
const picker = find('#product-picker');
const query = find('#product-query');
const datalist = find('#products');
const pickerNotice = find('#picker-notice');
const ruleForm = find('#product-rules');
const ruleNotice = ruleForm.querySelector('output');
const gradeTable = find('#quality-settings');
const undo = ruleForm.querySelector('[type="reset"]');
const base = [find('#product-defaults [name="discount"]'), find('#product-defaults [name="days"]')];
base[1].max = MAX_DAYS;

const template = find('#quality-row');
const rows = find('#quality-rows');
const grades = [];
for (let quality = 0; quality <= 12; quality += 1) {
  const row = template.content.firstElementChild.cloneNode(true);
  const inputs = [...row.querySelectorAll('input')];
  row.querySelector('th').textContent = 'Q' + quality;
  inputs[1].max = MAX_DAYS;
  rows.append(row);
  grades.push(inputs);
}
const ruleInputs = [base, ...grades].flat();

const keys = [...settingsKeys, 'knownProducts'];
const stored = await chrome.storage.local.get(keys);
let preferences = readPreferences(stored);
let productId;

function productName(id) {
  const names = productNames[id]?.split(' / ');
  return names?.[language === 'zh-CN' ? 0 : 1] ?? stored.knownProducts?.[id] ?? text('product');
}

function productLabel(id) {
  return `${productName(id)} · #${id}`;
}

function updateProducts() {
  const ids = new Set([
    ...Object.keys(productNames),
    ...Object.keys(stored.knownProducts ?? {}),
    ...Object.keys(preferences.productRules),
  ]);
  const options = [...ids].sort((a, b) => productName(a).localeCompare(productName(b), language));
  datalist.replaceChildren(...options.map(id => {
    const option = document.createElement('option');
    option.value = productLabel(id);
    option.dataset.id = id;
    if (Object.hasOwn(preferences.productRules, id)) option.label = text('hasRules');
    return option;
  }));
}

function localizeProducts() {
  grades.forEach(([discount, days], quality) => {
    discount.setAttribute('aria-label', `Q${quality} ${text('discount')}`);
    days.setAttribute('aria-label', `Q${quality} ${text('periodDays')}`);
  });
  if (productId) find('#product-name').textContent = productLabel(productId);
  updateProducts();
}

function inheritValues() {
  base[0].placeholder = String(preferences.discount);
  base[1].placeholder = String(preferences.days);
  for (const [discount, days] of grades) {
    discount.placeholder = base[0].value || base[0].placeholder;
    days.placeholder = base[1].value || base[1].placeholder;
  }
}

function showRules() {
  const product = preferences.productRules[productId] ?? {};
  function show([discount, days], rule) {
    discount.value = discount.defaultValue = rule?.discount ?? '';
    days.value = days.defaultValue = rule?.days ?? '';
  }
  show(base, product);
  grades.forEach((inputs, quality) => show(inputs, product.qualities?.[quality]));
  undo.hidden = true;
  inheritValues();
}

function hasDraft() {
  return ruleInputs.some(input => input.value !== input.defaultValue || input.validity.badInput);
}

function openProduct(id) {
  if (!Number.isSafeInteger(id) || id < 1) return;
  if (id !== productId && hasDraft()) {
    setNotice(pickerNotice, 'saveDraftFirst');
    return;
  }
  setNotice(pickerNotice);
  query.value = '';
  if (id === productId) return;
  productId = id;
  find('#product-name').textContent = productLabel(id);
  ruleForm.hidden = false;
  gradeTable.open = false;
  setNotice(ruleNotice);
  showRules();
}

const searchTerm = value => value.trim().normalize('NFKC').toLowerCase();
picker.addEventListener('submit', event => {
  event.preventDefault();
  const term = searchTerm(query.value);
  const number = /^#?\s*(\d+)$/.exec(term)?.[1];
  if (Number.isSafeInteger(Number(number)) && Number(number) > 0) {
    openProduct(Number(number));
    return;
  }
  const options = [...datalist.options].map(option => {
    const id = option.dataset.id;
    const names = productNames[id]?.split(' / ') ?? [productName(id)];
    const knownName = stored.knownProducts?.[id];
    return { id, terms: [option.value, ...names, knownName].filter(Boolean).map(searchTerm) };
  });
  const exact = options.filter(option => option.terms.includes(term));
  const matches = exact.length ? exact : options.filter(option => term && option.terms.some(name => name.includes(term)));
  if (matches.length === 1) openProduct(Number(matches[0].id));
  else setNotice(pickerNotice, matches.length ? 'chooseProduct' : 'productMissing');
});

query.addEventListener('input', () => setNotice(pickerNotice));
ruleForm.addEventListener('input', () => {
  undo.hidden = !hasDraft();
  inheritValues();
});
ruleForm.addEventListener('reset', event => {
  event.preventDefault();
  setNotice(pickerNotice);
  setNotice(ruleNotice);
  showRules();
});
gradeTable.addEventListener('invalid', () => { gradeTable.open = true; }, true);

onSave(ruleForm, async () => {
  const changes = [base, ...grades].map(([discount, days], index) => {
    const change = { quality: index === 0 ? null : index - 1 };
    if (discount.value !== discount.defaultValue) change.discount = discount.value === '' ? null : discount.valueAsNumber;
    if (days.value !== days.defaultValue) change.days = days.value === '' ? null : days.valueAsNumber;
    return change;
  }).filter(change => 'discount' in change || 'days' in change);
  stored.productRules = await patchProductRules(productId, changes);
  preferences = readPreferences(stored);
  showRules();
  setNotice(pickerNotice);
  updateProducts();
});

const appearance = find('#appearance');
const { autoFetch, scope, date, prices, chartLink, precision, layout, theme, overview, coverage, localizedNumbers } =
  appearance.elements;
autoFetch.checked = preferences.autoFetch;
scope.value = preferences.scope;
date.checked = preferences.display.date;
prices.value = preferences.display.vwap
  ? (preferences.display.discounted ? 'both' : 'vwap')
  : 'discounted';
chartLink.checked = preferences.display.chartLink;
overview.checked = preferences.display.overview;
coverage.checked = preferences.display.coverage;
localizedNumbers.checked = preferences.display.localizedNumbers;
precision.value = preferences.display.precision;
layout.value = preferences.display.layout;
theme.value = preferences.theme;
onSave(appearance, () => patchSettings({
  autoFetch: autoFetch.checked,
  scope: scope.value,
  theme: theme.value,
  display: {
    vwap: prices.value !== 'discounted',
    discounted: prices.value !== 'vwap',
    date: date.checked,
    chartLink: chartLink.checked,
    overview: overview.checked,
    coverage: coverage.checked,
    localizedNumbers: localizedNumbers.checked,
    precision: precision.value === 'auto' ? 'auto' : Number(precision.value),
    layout: layout.value,
  },
}));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const updated = keys.filter(key => Object.hasOwn(changes, key));
  if (!updated.length) return;
  for (const key of updated) stored[key] = changes[key].newValue;
  preferences = readPreferences(stored);
  if (changes.productRules || changes.knownProducts) updateProducts();
  if (productId) {
    if (changes.productRules && !hasDraft()) showRules();
    else inheritValues();
  }
});

document.addEventListener('warehouse-vwap:language', localizeProducts);
localizeProducts();
openProduct(Number(new URLSearchParams(location.search).get('resource')));
