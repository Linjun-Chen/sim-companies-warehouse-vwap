import './defaults.js';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (tab?.url?.startsWith('https://www.simcompanies.com/')) {
  const page = await chrome.tabs.sendMessage(tab.id, { type: 'warehouse-vwap:product' }, { frameId: 0 })
    .catch(() => null);
  if (page?.resource) {
    const url = new URL('settings.html', location.href);
    url.searchParams.set('resource', page.resource);
    document.querySelector('#more').href = url;
  }
}
