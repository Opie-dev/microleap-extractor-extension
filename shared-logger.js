// Shared logging functionality that can be used across different scripts

// Initialize logging system
let logHistory = [];
let logContainer = null;

// Initialize the logger (call this when DOM is ready)
function initLogger(containerElement) {
    logContainer = containerElement;
    loadLogHistory();
}

// The real addLog function - identical to popup.js version
function addLog(message, type = 'info') {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const logEntry = {
        timestamp: timestamp,
        message: message,
        type: type,
        fullTimestamp: now.toISOString(),
        date: now.toLocaleDateString()
    };
    
    // Add to history
    logHistory.push(logEntry);
    
    // Keep only last 100 log entries to avoid storage bloat
    if (logHistory.length > 100) {
        logHistory = logHistory.slice(-100);
    }
    
    // Save to localStorage
    localStorage.setItem('microleap_log_history', JSON.stringify(logHistory));
    
    // Display in UI (if container is available)
    if (logContainer) {
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${type}`;
        logElement.textContent = `[${timestamp}] ${message}`;
        logContainer.appendChild(logElement);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Also log to console for debugging
    console.log(`[${timestamp}] ${message}`);
}

function loadLogHistory() {
    try {
        const storedLogs = localStorage.getItem('microleap_log_history');
        if (storedLogs) {
            logHistory = JSON.parse(storedLogs);
            
            // Restore logs to UI if container is available
            if (logContainer) {
                logContainer.innerHTML = '';
                logHistory.forEach(log => {
                    const logElement = document.createElement('div');
                    logElement.className = `log-entry ${log.type}`;
                    logElement.textContent = `[${log.timestamp}] ${log.message}`;
                    logContainer.appendChild(logElement);
                });
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
    clearLogHistory
};
