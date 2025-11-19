const deepl = require('deepl-node');

const languageNames = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (Mandarin)',
  ja: 'Japanese',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ko: 'Korean',
  tr: 'Turkish'
};

async function translateMessage(text, sourceLang, targetLang) {
  try {
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

    const deeplLangMap = {
      'en': 'EN-US',
      'es': 'ES',
      'fr': 'FR',
      'de': 'DE',
      'zh': 'ZH',
      'ja': 'JA',
      'pt': 'PT-PT',
      'it': 'IT',
      'nl': 'NL',
      'pl': 'PL',
      'ru': 'RU',
      'ar': 'AR',
      'ko': 'KO',
      'tr': 'TR'
    };
    
    const targetLangCode = deeplLangMap[targetLang] || targetLang.toUpperCase();
    
    const result = await translator.translateText(
      text,
      null,
      targetLangCode
    );

    return {
      translation: result.text,
      note: `Translated from ${languageNames[sourceLang]} to ${languageNames[targetLang]}`
    };

  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Translation service failed');
  }
}

module.exports = { translateMessage };