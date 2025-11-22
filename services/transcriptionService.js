const { createClient } = require("@deepgram/sdk");

async function transcribeAudio(audioBuffer, language = 'en') {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const deepgramLangMap = {
      'en': 'en-US',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'zh': 'zh',
      'ja': 'ja',
      'pt': 'pt',
      'it': 'it',
      'nl': 'nl',
      'pl': 'pl',
      'ru': 'ru',
      'ar': 'ar',
      'ko': 'ko',
      'tr': 'tr'
    };

    const deepgramLang = deepgramLangMap[language] || 'en-US';

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        language: deepgramLang,
        smart_format: true,
        punctuate: true
      }
    );

    if (error) {
      throw new Error('Deepgram transcription error');
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;

    if (!transcript || transcript.trim() === '') {
      throw new Error('No transcript generated - check source language');
    }

    return transcript;

  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Please select the correct source language');
  }
}

module.exports = { transcribeAudio };