document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
  
    // Load saved API Key if exists
    chrome.storage.local.get(['geminiApiKey'], result => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
      }
    });
  
    // Save API Key
    saveBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        status.textContent = "API Key saved!";
        setTimeout(() => { status.textContent = ""; }, 2000);
      });
    });
  });
  