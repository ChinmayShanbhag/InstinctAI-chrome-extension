import { smartPrompt } from './tuner.js';

// Session memory to store exchanges while popup is open
let sessionMemory = [];

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['sessionMemory'], (result) => {
    sessionMemory = result.sessionMemory || [];

    if (sessionMemory.length === 0) {
      clearSessionMemory(false); // false = don't ask for manual user click
    } else {
      renderSessionMemory();
    }
  });

  const inputField = document.getElementById('input');
  const outputDiv = document.getElementById('output');
  const processBtn = document.getElementById('processBtn');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab.url.startsWith('http')) { // only if it's a real website
      chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTED_TEXT" }, (response) => {
        if (chrome.runtime.lastError) {
          // console.warn("No content script found or other error:", chrome.runtime.lastError.message);
          return;
        }
        if (response && response.selectedText) {
          const inputField = document.getElementById('input');
          inputField.value = response.selectedText;
          inputField.focus();
        }
      });
    } else {
      // console.warn("Not a webpage - cannot get selection");
    }
  });
  

  // Setup button click for process
  processBtn.addEventListener('click', () => smartProcess());

  // Setup tab switchers HERE:
  document.getElementById('tab-current').addEventListener('click', () => {
    document.getElementById('tab-content-current').style.display = 'block';
    document.getElementById('tab-content-memory').style.display = 'none';
    document.getElementById('tab-current').classList.add('tab-active');
    document.getElementById('tab-memory').classList.remove('tab-active');
  });

  document.getElementById('tab-memory').addEventListener('click', () => {
    document.getElementById('tab-content-current').style.display = 'none';
    document.getElementById('tab-content-memory').style.display = 'block';
    document.getElementById('tab-current').classList.remove('tab-active');
    document.getElementById('tab-memory').classList.add('tab-active');
  });

 });


// ✅ SMART PROCESS (no more handlePreset)
async function smartProcess() {
  const inputField = document.getElementById('input');
  const outputDiv = document.getElementById('output');
  const userText = inputField.value.trim();

  if (!userText) {
    outputDiv.textContent = "Please highlight or enter some text!";
    return;
  }

  let finalPrompt = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;

    finalPrompt = await smartPrompt(userText, url);

    // 🌀 Show spinner
    outputDiv.innerHTML = `<div class="loader"></div>`;

    // 🧠 Force browser to PAINT spinner before blocking with fetch
    await new Promise(requestAnimationFrame);

    const result = await callGemini(finalPrompt);

    sessionMemory.push({
      user: inputField.value.trim(),
      ai: result
    });    

    renderSessionMemory();

    saveSessionMemory();


    outputDiv.textContent = result;

    saveHistory(finalPrompt, result);

  } catch (error) {
    console.error(error);
    outputDiv.textContent = "Error: " + error.message;
  }
}


// ✅ Gemini API Caller
async function callGemini(userInput) {
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
              temperature: 0.5, 
              maxOutputTokens: 512,
              topP: 0.9,
              topK: 40
            }
          })
        });

        const data = await response.json();
        resolve(data.candidates[0].content.parts[0].text);
      } catch (err) {
        reject(err);
      }
    });
  });
}


// ✅ Save to History
function saveHistory(prompt, response) {
  chrome.storage.local.get({ history: [] }, (data) => {
    const updatedHistory = data.history;
    updatedHistory.push({ prompt, response, time: new Date().toISOString() });
    chrome.storage.local.set({ history: updatedHistory });
  });
}

function renderSessionMemory() {
  const memoryContainer = document.getElementById('memoryContainer');
  memoryContainer.innerHTML = ''; // Clear previous memory

  if (sessionMemory.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-memory';
    emptyDiv.textContent = "No chats yet.";
    memoryContainer.appendChild(emptyDiv);
    return;
  }

  const reversedMemory = [...sessionMemory].reverse();

  reversedMemory.forEach(pair => {
    const wrapper = document.createElement('div');
    wrapper.className = 'memory-entry';

    const userDiv = document.createElement('div');
    userDiv.className = 'chat-user';
    userDiv.textContent = `You: ${pair.user}`;

    const aiDiv = document.createElement('div');
    aiDiv.className = 'chat-ai';
    aiDiv.textContent = `AI: ${pair.ai}`;

    wrapper.appendChild(userDiv);
    wrapper.appendChild(aiDiv);

    memoryContainer.appendChild(wrapper);
  });
}


function saveSessionMemory() {
  chrome.storage.local.set({ sessionMemory });
}

document.getElementById('clearMemoryBtn').addEventListener('click', () => {
  sessionMemory = [];
  chrome.storage.local.remove('sessionMemory', () => {
    renderSessionMemory();
  });
});

function clearSessionMemory(fromUserClick = true) {
  sessionMemory = [];
  chrome.storage.local.remove('sessionMemory', () => {
    renderSessionMemory();
    if (fromUserClick) {
      console.log("Memory cleared manually.");
    }
  });
}