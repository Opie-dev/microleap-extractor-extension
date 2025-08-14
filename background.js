// MicroLeap Investment Data Extractor - Background Script

const STATE = {
  tabId: null,
  isLoggedIn: false,
  extractionData: null,
  progress: 0,
  extractionInProgress: false
};

// Open or focus MicroLeap dashboard
async function openMicroLeapDashboard() {
  const url = "https://dashboard.microleapasia.com/";
  const tabs = await chrome.tabs.query({ url: url + "*" });
  
  let tab;
  if (tabs && tabs.length > 0) {
    // Focus existing tab
    tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
  } else {
    // Create new tab
    tab = await chrome.tabs.create({ url });
  }
  
  STATE.tabId = tab.id;
  return tab.id;
}

// Check if user is logged in (not on login page)
async function checkLoginStatus(tabId) {
  try {
  const tab = await chrome.tabs.get(tabId);
    console.log(`Checking login status for tab ${tabId}, URL: ${tab.url}`);
    
    if (!tab.url) {
      console.log("Tab URL not available yet");
      return false;
    }
    
    const isLoginPage = /\/login(\?|$|#)/.test(tab.url);
    const isLoggedIn = !isLoginPage;
    
    console.log(`Login page detected: ${isLoginPage}, Logged in: ${isLoggedIn}`);
    return isLoggedIn;
  } catch (error) {
    console.error("Error checking login status:", error);
    return false;
  }
}

// Wait for tab to complete loading with timeout
function waitForTabComplete(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let completed = false;
    
    // Set up timeout
    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        chrome.tabs.onUpdated.removeListener(listener);
        console.log(`Tab ${tabId} loading timeout, continuing anyway...`);
        resolve(); // Resolve anyway, don't reject
      }
    }, timeoutMs);
    
    // Check if tab is already complete
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting tab:", chrome.runtime.lastError);
        clearTimeout(timeout);
        completed = true;
        resolve();
        return;
      }
      
      if (tab.status === "complete") {
        console.log(`Tab ${tabId} already complete`);
        clearTimeout(timeout);
        completed = true;
        resolve();
        return;
      }
      
      console.log(`Tab ${tabId} status: ${tab.status}, waiting for complete...`);
    });
    
    const listener = (id, changeInfo) => {
      if (!completed && id === tabId) {
        console.log(`Tab ${tabId} update:`, changeInfo);
        
        if (changeInfo.status === "complete") {
          completed = true;
          clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
          console.log(`Tab ${tabId} loading complete`);
        resolve();
        }
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Start the extraction process
async function startExtraction(tabId) {
  try {
    STATE.progress = 0;
    STATE.extractionData = null;
    
    // Navigate to investment list page
    await chrome.tabs.update(tabId, { 
      url: "https://dashboard.microleapasia.com/investment/me" 
    });
      await waitForTabComplete(tabId);
    
    // Send message to content script to start extraction
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Extraction timeout"));
      }, 300000); // 5 minute timeout
      
      chrome.tabs.sendMessage(tabId, { action: "startExtraction" }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          STATE.extractionData = response.data;
          resolve(response.data);
        } else {
          reject(new Error(response?.error || "Extraction failed"));
        }
      });
    });
  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
}

// Handle all messages (both from popup and content script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle log messages from content script
  if (message.type === "logMessage") {
    // Forward to popup if it's open
    chrome.runtime.sendMessage({
      type: "logMessage",
      message: message.message,
      logType: message.logType || 'info'
    }).catch(() => {
      // Popup might not be open, ignore error
    });
    return;
  }
  
  // Handle progress updates from content script
  if (message.type === "progressUpdate") {
    STATE.progress = message.progress;
    // Forward to popup if it's open
    chrome.runtime.sendMessage({
      type: "progressUpdate",
      progress: message.progress,
      message: message.message
    }).catch(() => {
      // Popup might not be open, ignore error
    });
    return;
  }
  
  if (message.type === "extractionComplete") {
    STATE.extractionData = message.data;
    STATE.progress = 100;
    STATE.extractionInProgress = false; // Reset extraction flag
    // Forward to popup
    chrome.runtime.sendMessage({
      type: "extractionComplete",
      data: message.data
    }).catch(() => {
      // Popup might not be open, ignore error
    });
    return;
  }
  
  if (message.type === "extractionError") {
    STATE.progress = 0;
    STATE.extractionInProgress = false; // Reset extraction flag
    // Forward to popup
    chrome.runtime.sendMessage({
      type: "extractionError",
      error: message.error
    }).catch(() => {
      // Popup might not be open, ignore error
    });
    return;
  }

  // Handle messages from popup
  const handleAsync = async () => {
    try {
      console.log("Background received message:", message.action);
      
      switch (message.action) {
        case "checkDashboard":
          console.log("Checking dashboard connection...");
          try {
            const url = "https://dashboard.microleapasia.com/";
            const tabs = await chrome.tabs.query({ url: url + "*" });
            
            if (tabs && tabs.length > 0) {
              STATE.tabId = tabs[0].id;
              sendResponse({ 
                success: true, 
                isOpen: true,
                tabId: STATE.tabId,
                message: "Dashboard tab found" 
              });
            } else {
              STATE.tabId = null;
              sendResponse({ 
                success: true, 
                isOpen: false,
                message: "Dashboard not open" 
              });
            }
          } catch (error) {
            console.error("Error checking dashboard:", error);
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          }
          break;
          
        case "openDashboard":
          console.log("Opening dashboard...");
          const tabId = await openMicroLeapDashboard();
          console.log("Dashboard opened, tabId:", tabId);
          
          try {
            await waitForTabComplete(tabId);
            console.log("Tab loading complete");
          } catch (error) {
            console.log("Tab loading had issues, but continuing:", error.message);
          }
          
          // Add a small delay to ensure page is ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const isLoggedIn = await checkLoginStatus(tabId);
          console.log("Login status:", isLoggedIn);
          STATE.isLoggedIn = isLoggedIn;
          sendResponse({ 
            success: true, 
            isLoggedIn, 
            message: isLoggedIn ? "Dashboard opened successfully" : "Please log in manually" 
          });
          break;
          
        case "checkLoginStatus":
          console.log("Checking login status...");
          if (STATE.tabId) {
            const loggedIn = await checkLoginStatus(STATE.tabId);
            STATE.isLoggedIn = loggedIn;
            sendResponse({ 
              success: true, 
              isLoggedIn: loggedIn,
              message: loggedIn ? "Logged in successfully" : "Please log in first"
            });
          } else {
            sendResponse({ 
              success: false, 
              error: "No dashboard tab found" 
            });
          }
          break;
          
        case "startExtraction":
          console.log("Starting extraction...");
          
          // Prevent duplicate extraction calls
          if (STATE.extractionInProgress) {
            console.log("Extraction already in progress, ignoring duplicate call");
            sendResponse({ 
              success: false, 
              error: "Extraction already in progress" 
            });
            break;
          }
          
          STATE.extractionInProgress = true;
          
          try {
            if (!STATE.tabId) {
              await openMicroLeapDashboard();
              await waitForTabComplete(STATE.tabId);
            }
            
            const data = await startExtraction(STATE.tabId);
            sendResponse({ 
              success: true, 
              data,
              count: data.investments ? data.investments.length : 0
            });
          } finally {
            STATE.extractionInProgress = false;
          }
          break;
          
        case "getProgress":
          sendResponse({ 
            success: true, 
            progress: STATE.progress 
          });
          break;
          
        case "getExtractionData":
          // Try to get data from localStorage first, then fallback to STATE
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'getStoredData'}, (response) => {
                if (response && response.success && response.data) {
                  sendResponse({ 
                    success: true, 
                    data: response.data 
                  });
                } else {
                  sendResponse({ 
                    success: true, 
                    data: STATE.extractionData 
                  });
                }
              });
            } else {
              sendResponse({ 
                success: true, 
                data: STATE.extractionData 
              });
            }
          });
          return true; // Keep channel open for async response
          
        case "clearStoredData":
          // Forward clear command to content script
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'clearStoredData'}, (response) => {
                if (response && response.success) {
                  STATE.extractionData = null; // Also clear from background state
                  sendResponse({ success: true });
                } else {
                  sendResponse({ success: false, error: 'Failed to clear stored data' });
                }
              });
            } else {
              sendResponse({ success: false, error: 'No active tab found' });
            }
          });
          return true;
          
        case "cancelExtraction":
          console.log("Cancelling extraction...");
          STATE.extractionInProgress = false; // Reset extraction flag
          if (STATE.tabId) {
            // Send cancel message to content script
            chrome.tabs.sendMessage(STATE.tabId, {action: 'cancelExtraction'}, (response) => {
              if (response && response.success) {
                // Update extraction data status instead of deleting it
                if (STATE.extractionData) {
                  STATE.extractionData.status = 'cancelled';
                  STATE.extractionData.cancelled_at = new Date().toISOString();
                }
                STATE.progress = 0;
                sendResponse({ success: true, message: 'Extraction cancelled' });
              } else {
                sendResponse({ success: false, error: response?.error || 'Failed to cancel extraction' });
              }
            });
          } else {
            // No active extraction tab, consider it cancelled
            if (STATE.extractionData) {
              STATE.extractionData.status = 'cancelled';
              STATE.extractionData.cancelled_at = new Date().toISOString();
            }
            STATE.progress = 0;
            sendResponse({ success: true, message: 'No active extraction to cancel' });
          }
      return true;
          
        default:
          console.log("Unknown action:", message.action);
          sendResponse({ 
            success: false, 
            error: "Unknown action" 
          });
      }
    } catch (error) {
      console.error("Background script error:", error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  };
  
  // Only handle async for popup messages (those with action property)
  if (message.action) {
    handleAsync();
    return true; // Keep message channel open for async response
  }
});

console.log("MicroLeap Investment Data Extractor background script loaded");
