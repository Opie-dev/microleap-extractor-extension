// Shared logging functionality that can be used across different scripts

// Initialize logging system
let logHistory = [];
let logContainer = null;

// Global duplicate prevention using localStorage and window object
const DUPLICATE_TRACKING_KEY = 'microleap_duplicate_tracking';
const DUPLICATE_WINDOW_MS = 2000; // 2 seconds window for duplicate prevention

// Global function to check and prevent duplicates
function isDuplicateMessage(message, type) {
    try {
        const now = Date.now();
        const messageKey = `${message}_${type}`;
        
        // Check localStorage for recent duplicates (survives script reloads)
        const storedTracking = localStorage.getItem(DUPLICATE_TRACKING_KEY);
        let duplicateTracking = {};
        
        if (storedTracking) {
            duplicateTracking = JSON.parse(storedTracking);
            
            // Clean up old entries (older than duplicate window)
            Object.keys(duplicateTracking).forEach(key => {
                if (now - duplicateTracking[key] > DUPLICATE_WINDOW_MS) {
                    delete duplicateTracking[key];
                }
            });
        }
        
        // Check if this message was logged recently
        if (duplicateTracking[messageKey] && (now - duplicateTracking[messageKey]) < DUPLICATE_WINDOW_MS) {
            console.log(`Duplicate prevented (global): "${message}" - last seen ${now - duplicateTracking[messageKey]}ms ago`);
            return true;
        }
        
        // Record this message
        duplicateTracking[messageKey] = now;
        localStorage.setItem(DUPLICATE_TRACKING_KEY, JSON.stringify(duplicateTracking));
        
        return false;
    } catch (error) {
        console.error('Error in duplicate detection:', error);
        return false; // On error, allow the message to go through
    }
}

// Initialize the logger (call this when DOM is ready)
function initLogger(containerElement) {
    logContainer = containerElement;
    loadLogHistory();
}

// Simple hash function for creating safe IDs
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

// The real addLog function - with global duplicate prevention
function addLog(message, type = 'info') {
    // Global duplicate check - this works across all script instances
    if (isDuplicateMessage(message, type)) {
        return; // Message is a duplicate, skip logging
    }
    
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    // Create a safe ID using hash to avoid special characters in selectors
    const logEntryId = `log-${simpleHash(message + type + timestamp)}`;
    
    const logEntry = {
        id: logEntryId,
        timestamp: timestamp,
        message: message,
        type: type,
        fullTimestamp: now.toISOString(),
        date: now.toLocaleDateString()
    };
    
    // ALWAYS display in UI first (regardless of storage limit)
    if (logContainer) {
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${type}`;
        logElement.textContent = `[${timestamp}] ${message}`;
        logElement.setAttribute('data-log-id', logEntryId);
        logContainer.appendChild(logElement);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Add to history for localStorage
    logHistory.push(logEntry);
    
    // Keep only last 100 log entries in localStorage to avoid storage bloat
    // Note: UI continues showing ALL logs, only localStorage is limited
    if (logHistory.length > 100) {
        logHistory = logHistory.slice(-100);
    }
    
    // Save to localStorage (limited to 100 entries)
    localStorage.setItem('microleap_log_history', JSON.stringify(logHistory));
    
    // Also log to console for debugging
    console.log(`[${timestamp}] ${message}`);
}

function loadLogHistory() {
    try {
        const storedLogs = localStorage.getItem('microleap_log_history');
        if (storedLogs) {
            logHistory = JSON.parse(storedLogs);
            
            // Migrate old log entries to use safe IDs
            let needsUpdate = false;
            logHistory.forEach(log => {
                const safeId = `log-${simpleHash(log.message + log.type + log.timestamp)}`;
                if (log.id !== safeId) {
                    log.id = safeId;
                    needsUpdate = true;
                }
            });
            
            // Save updated log history if we migrated any IDs
            if (needsUpdate) {
                localStorage.setItem('microleap_log_history', JSON.stringify(logHistory));
                console.log('Migrated log history to use safe IDs');
            }
            
            // Restore logs to UI if container is available
            if (logContainer) {
                logContainer.innerHTML = '';
                
                // Display existing logs immediately without animation (for popup load)
                logHistory.forEach((log) => {
                    const logElement = document.createElement('div');
                    logElement.className = `log-entry ${log.type}`;
                    logElement.textContent = `[${log.timestamp}] ${log.message}`;
                    
                    // Always generate a safe ID (ignore old unsafe IDs from localStorage)
                    const logId = `log-${simpleHash(log.message + log.type + log.timestamp)}`;
                    logElement.setAttribute('data-log-id', logId);
                    
                    // Check if this log element already exists in the container
                    const existingElement = logContainer.querySelector(`[data-log-id="${logId}"]`);
                    if (existingElement) {
                        console.log('Skipping duplicate log element:', log.message);
                        return;
                    }
                    
                    // No animation for existing logs - they appear immediately
                    logElement.style.opacity = '1';
                    logElement.style.transform = 'translateY(0)';
                    
                    logContainer.appendChild(logElement);
                });
                
                // Auto-scroll to bottom after all logs are loaded
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Error loading log history:', error);
    }
}

function clearLogHistory() {
    logHistory = [];
    localStorage.removeItem('microleap_log_history');
    
    // Also clear duplicate tracking when logs are cleared
    localStorage.removeItem(DUPLICATE_TRACKING_KEY);
    
    if (logContainer) {
        logContainer.innerHTML = '';
    }
    addLog('Log history cleared.');
}

// Export functions for use in other scripts
window.MicroLeapLogger = {
    initLogger,
    addLog,
    loadLogHistory,
    clearLogHistory,
    simpleHash
};
