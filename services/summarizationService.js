require('dotenv').config();

async function summarizeText(text, language = 'en') {
  try {
    // add required language parameter to the URL
    const url = `https://api.deepgram.com/v1/read?language=${language}&sentiment=true&summarize=true&topics=true&intents=true`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Deepgram API error:', errorData);
      throw new Error(`Deepgram API error: ${response.status} - ${errorData.err_msg || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // format the response into a readable summary
    let formattedSummary = '';
    
    // add summary if available
    if (data.results?.summary?.short) {
      formattedSummary += `**Summary:**\n${data.results.summary.short}\n\n`;
    } else if (data.results?.summary?.text) {
      formattedSummary += `**Summary:**\n${data.results.summary.text}\n\n`;
    }
    
    // add sentiment analysis
    if (data.results?.sentiments) {
      const sentiments = data.results.sentiments;
      
      if (sentiments.average) {
        const sentiment = sentiments.average.sentiment || 'neutral';
        const score = sentiments.average.sentiment_score || 0;
        formattedSummary += `**Overall Sentiment:** ${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} (Score: ${score.toFixed(2)})\n\n`;
      }
      
      // add sentiment breakdown if there are segments
      if (sentiments.segments && sentiments.segments.length > 0) {
        formattedSummary += `**Sentiment Breakdown:**\n`;
        sentiments.segments.slice(0, 5).forEach((segment, index) => {
          const sent = segment.sentiment || 'neutral';
          const score = segment.sentiment_score || 0;
          const text = segment.text || '';
          if (text) {
            formattedSummary += `- ${sent.charAt(0).toUpperCase() + sent.slice(1)} (${score.toFixed(2)}): "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n`;
          }
        });
        formattedSummary += '\n';
      }
    }
    
    // add topics if available
    if (data.results?.topics?.segments && data.results.topics.segments.length > 0) {
      formattedSummary += `**Key Topics:**\n`;
      const topicsSet = new Set();
      
      data.results.topics.segments.forEach(segment => {
        if (segment.topics && Array.isArray(segment.topics)) {
          segment.topics.forEach(topic => {
            if (topic.topic) {
              const confidence = (topic.confidence_score || 0) * 100;
              topicsSet.add(`${topic.topic} (confidence: ${confidence.toFixed(0)}%)`);
            }
          });
        }
      });
      
      if (topicsSet.size > 0) {
        Array.from(topicsSet).slice(0, 10).forEach(topic => {
          formattedSummary += `- ${topic}\n`;
        });
        formattedSummary += '\n';
      }
    }
    
    // add intents if available
    if (data.results?.intents?.segments && data.results.intents.segments.length > 0) {
      formattedSummary += `**Detected Intents:**\n`;
      const intentsSet = new Set();
      
      data.results.intents.segments.forEach(segment => {
        if (segment.intents && Array.isArray(segment.intents)) {
          segment.intents.forEach(intent => {
            if (intent.intent) {
              const confidence = (intent.confidence_score || 0) * 100;
              intentsSet.add(`${intent.intent} (confidence: ${confidence.toFixed(0)}%)`);
            }
          });
        }
      });
      
      if (intentsSet.size > 0) {
        Array.from(intentsSet).slice(0, 10).forEach(intent => {
          formattedSummary += `- ${intent}\n`;
        });
      }
    }
    
    return formattedSummary.trim() || 'Summary generated successfully, but no detailed information was extracted.';

  } catch (error) {
    console.error('Summarization error:', error);
    
    // provide more specific error messages
    if (error.message.includes('401')) {
      throw new Error('Invalid Deepgram API key. Please check your credentials.');
    } else if (error.message.includes('400')) {
      throw new Error('Invalid request to Deepgram API. Please check the text format.');
    } else if (error.message.includes('429')) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    throw new Error(`Summarization service failed: ${error.message}`);
  }
}

module.exports = { summarizeText };