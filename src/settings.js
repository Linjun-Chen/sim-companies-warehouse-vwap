import { MAX_DAYS, settingsKeys, readPreferences, patchSettings, onSave } from './defaults.js';
import { productNames } from './product-names.js';

const find = selector => document.querySelector(selector);
const picker = find('#product-picker');
const query = find('#product-query');
const datalist = find('#products');
const pickerNotice = find('#picker-notice');
const ruleForm = find('#product-rules');
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
  inputs[0].setAttribute('aria-label', 'Q' + quality + ' 下调 %');
  inputs[1].setAttribute('aria-label', 'Q' + quality + ' VWAP 天数');
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
  return productNames[id] ?? stored.knownProducts?.[id] ?? '商品 #' + id;
}

function updateProducts() {
  const ids = new Set([
    ...Object.keys(productNames),
    ...Object.keys(stored.knownProducts ?? {}),
    ...Object.keys(preferences.productRules),
  ]);
  const options = [...ids].sort((a, b) => productName(a).localeCompare(productName(b), 'zh-CN'));
  datalist.replaceChildren(...options.map(id => {
    const option = document.createElement('option');
    const name = productName(id);
    option.value = name === '商品 #' + id ? name : name + ' · #' + id;
    option.dataset.id = id;
    if (Object.hasOwn(preferences.productRules, id)) option.label = '已设规则';
    return option;
  }));
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
    pickerNotice.textContent = '请先保存或撤销当前商品的修改';
    return;
  }
  pickerNotice.textContent = '';
  query.value = '';
  if (id === productId) return;
  productId = id;
  find('#product-name').textContent = productName(id);
  ruleForm.hidden = false;
  gradeTable.open = false;
  ruleForm.querySelector('output').textContent = '';
  showRules();
}

picker.addEventListener('submit', event => {
  event.preventDefault();
  const term = query.value.trim().normalize('NFKC').toLowerCase();
  const number = /^#?\s*(\d+)$/.exec(term)?.[1];
  if (Number.isSafeInteger(Number(number)) && Number(number) > 0) {
    openProduct(Number(number));
    return;
  }
  const options = [...datalist.options];
  const exact = options.filter(option => option.value.toLowerCase() === term ||
    productName(option.dataset.id).toLowerCase().split(' / ').includes(term));
  const matches = exact.length ? exact : options.filter(option => term && option.value.toLowerCase().includes(term));
  if (matches.length === 1) openProduct(Number(matches[0].dataset.id));
  else pickerNotice.textContent = matches.length ? '请从搜索结果中选择商品' : '未找到商品';
});

query.addEventListener('input', () => { pickerNotice.textContent = ''; });
ruleForm.addEventListener('input', () => {
  undo.hidden = !hasDraft();
  inheritValues();
});
ruleForm.addEventListener('reset', event => {
  event.preventDefault();
  pickerNotice.textContent = '';
  ruleForm.querySelector('output').textContent = '';
  showRules();
});
gradeTable.addEventListener('invalid', () => { gradeTable.open = true; }, true);

function readRule([discount, days]) {
  const rule = {};
  if (discount.value !== '') rule.discount = discount.valueAsNumber;
  if (days.value !== '') rule.days = days.valueAsNumber;
  return rule;
}

onSave(ruleForm, async () => {
  const id = productId;
  const product = readRule(base);
  const qualities = grades.map(readRule).map((rule, quality) => [quality, rule])
    .filter(([, rule]) => Object.keys(rule).length);
  if (qualities.length) product.qualities = Object.fromEntries(qualities);

  stored.productRules = await navigator.locks.request('warehouse-vwap:product-rules', async () => {
    const { productRules = {} } = await chrome.storage.local.get('productRules');
    if (Object.keys(product).length) productRules[id] = product;
    else delete productRules[id];
    await chrome.storage.local.set({ productRules });
    return productRules;
  });
  preferences = readPreferences(stored);
  showRules();
  pickerNotice.textContent = '';
  updateProducts();
});

const appearance = find('#appearance');
const { autoFetch, date, prices, chartLink, precision, layout, theme } = appearance.elements;
autoFetch.checked = preferences.autoFetch;
date.checked = preferences.display.date;
prices.value = preferences.display.vwap
  ? (preferences.display.discounted ? 'both' : 'vwap')
  : 'discounted';
chartLink.checked = preferences.display.chartLink;
precision.value = preferences.display.precision;
layout.value = preferences.display.layout;
theme.value = preferences.theme;
onSave(appearance, () => patchSettings({
  autoFetch: autoFetch.checked,
  theme: theme.value,
  display: {
    vwap: prices.value !== 'discounted',
    discounted: prices.value !== 'vwap',
    date: date.checked,
    chartLink: chartLink.checked,
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

updateProducts();
openProduct(Number(new URLSearchParams(location.search).get('resource')));
