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