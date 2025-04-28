import { smartPrompt } from './tuner.js';  // ✅ import properly

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToGemini",
    title: "Process with AI",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sendToGemini" && info.selectionText) {
    chrome.storage.local.get(['geminiApiKey', 'sessionMemory'], async (storageResult) => {
      const apiKey = storageResult.geminiApiKey;
      if (!apiKey) {
        alert("API Key not set. Please set it in extension options.");
        return;
      }

      try {
        const userText = info.selectionText.trim();
        const url = tab.url;

        // ✅ Call smartPrompt
        const finalPrompt = await smartPrompt(userText, url);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 512,
              topP: 0.9,
              topK: 40
            }
          })
        });

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;

        // ✅ Save to permanent history
        chrome.storage.local.get({ history: [] }, (data) => {
          const updatedHistory = data.history;
          updatedHistory.push({ prompt: finalPrompt, response: resultText, time: new Date().toISOString() });
          chrome.storage.local.set({ history: updatedHistory });
        });

        // ✅ Save to session memory
        let sessionMemory = storageResult.sessionMemory || [];
        sessionMemory.push({ user: userText, ai: resultText });
        chrome.storage.local.set({ sessionMemory });

        // Show result in a simple alert (you can replace with fancier later)
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => {
            alert(text);
          },
          args: [resultText]
        });

      } catch (error) {
        console.error("Failed to process with Gemini:", error);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            alert("Error connecting to Gemini API. Try again.");
          }
        });
      }
    });
  }
});
