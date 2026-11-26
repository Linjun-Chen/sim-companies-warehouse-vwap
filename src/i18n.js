(() => {
  const languages = {
    en: 'English',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    'pt-BR': 'Português',
    it: 'Italiano',
    ru: 'Русский',
    pl: 'Polski',
    tr: 'Türkçe',
    vi: 'Tiếng Việt',
    ar: 'العربية',
  };
  const catalogs = new Map();

  function uiLanguage(preference, browserLanguage) {
    if (Object.hasOwn(languages, preference)) return preference;
    const [base, ...variants] = browserLanguage.toLowerCase().split('-');
    if (base === 'zh') return variants.some(part => ['hant', 'tw', 'hk', 'mo'].includes(part)) ? 'zh-TW' : 'zh-CN';
    if (base === 'pt') return 'pt-BR';
    return Object.hasOwn(languages, base) ? base : 'en';
  }

  function direction(language) {
    return language === 'ar' ? 'rtl' : 'ltr';
  }

  function localeDirectory(language) {
    return language.replace('-', '_');
  }

  async function loadCatalog(language) {
    if (!catalogs.has(language)) {
      const url = chrome.runtime.getURL(`_locales/${localeDirectory(language)}/messages.json`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Missing locale ${language}`);
      const dictionary = await response.json();
      catalogs.set(language, Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key, value.message])));
    }
    return catalogs.get(language);
  }

  function translator(messages) {
    return (key, ...values) => messages[key].replace(/\{(\d+)\}/g, (_, slot) => values[slot]);
  }

  globalThis.scwvI18n = { languages, uiLanguage, direction, localeDirectory, loadCatalog, translator };
})();
