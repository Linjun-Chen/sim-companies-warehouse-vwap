import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import '../src/i18n.js';

const { languages, uiLanguage, direction, localeDirectory } = globalThis.scwvI18n;

test('Chrome language variants resolve to the intended locale and respect manual selection', () => {
  const examples = {
    'zh-SG': 'zh-CN', 'zh-Hant-HK': 'zh-TW', 'fr-CA': 'fr', 'es-419': 'es',
    'pt-PT': 'pt-BR', 'ar-EG': 'ar', 'en-GB': 'en', 'nb': 'en',
  };
  for (const [browserLanguage, expected] of Object.entries(examples)) {
    assert.equal(uiLanguage('auto', browserLanguage), expected);
    assert.equal(uiLanguage('ja', browserLanguage), 'ja');
  }
  assert.equal(direction('ar'), 'rtl');
  assert.equal(direction('en'), 'ltr');
});

test('every supported locale defines the same UI strings and interpolation fields', async () => {
  const catalog = async language => JSON.parse(await readFile(
    new URL(`../_locales/${localeDirectory(language)}/messages.json`, import.meta.url), 'utf8',
  ));
  const english = await catalog('en');
  const keys = Object.keys(english).sort();
  const slots = value => Array.from(value.matchAll(/\{\d+\}/g), match => match[0]).sort();
  for (const language of Object.keys(languages)) {
    const messages = await catalog(language);
    assert.deepEqual(Object.keys(messages).sort(), keys, language);
    for (const key of keys) {
      const label = `${language}/${key}`;
      assert.ok(messages[key].message.trim(), label);
      assert.deepEqual(slots(messages[key].message), slots(english[key].message), label);
    }
  }
});
