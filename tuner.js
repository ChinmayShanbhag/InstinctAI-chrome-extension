// tuner.js

export async function smartPrompt(userText, url) {
    if (!userText || !url) return "";
  
    const predictionPrompt = `
  You are an assistant that predicts the best next action to perform on a given text and webpage context.
  
  Based on:
  - Text Content
  - Page URL
  
  Suggest what to do with the text. Examples include:
  Summarize, Explain, Expand, Rewrite, Translate, Critique, Simplify, Add Examples, Reframe, Other.
  
  Return a SHORT action phrase like: "Summarize formally", "Explain code", "Expand motivational text", "Simplify legal writing", etc.
  
  Webpage URL: ${url}
  
  Text:
  """
  ${userText}
  """
    `.trim();
  
    const suggestedAction = await callGeminiLite(predictionPrompt);
  
    console.log("[smartPrompt] Suggested Action:", suggestedAction);
  
    // Now dynamically build final prompt
    const finalPrompt = `
  Based on the following instruction: "${suggestedAction.trim()}"
  
  Process the following text accordingly:
  
  Text:
  """
  ${userText}
  """
    `.trim();
  
    return finalPrompt;
  }
  
  // Internal lightweight Gemini call
  async function callGeminiLite(userInput) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['geminiApiKey'], async (result) => {
        const apiKey = result.geminiApiKey;
        if (!apiKey) {
          reject(new Error("API Key not found. Please set it in extension options."));
          return;
        }
  
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: userInput }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 40,  // Small response, short action phrase
                topP: 0.9,
                topK: 40
              }
            })
          });
  
          const data = await response.json();
          const prediction = data.candidates[0].content.parts[0].text.trim();
          resolve(prediction);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
  