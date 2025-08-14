// MicroLeap Investment Data Extractor - Popup Script

let extractionData = null;

// DOM elements (will be initialized in DOMContentLoaded)
let elements = {};

// Logging system now handled by shared logger

// Helper function to access shared logger's addLog
function addLog(message, type = 'info') {
    return window.MicroLeapLogger.addLog(message, type);
}

// Helper function to access shared logger's loadLogHistory
function loadLogHistory() {
    return window.MicroLeapLogger.loadLogHistory();
}

// Use shared logger's clearLogHistory function but add UI update logic
function clearLogHistory() {
    window.MicroLeapLogger.clearLogHistory();
    
    // Update UI flow based on whether extraction data exists
    const hasData = extractionData && extractionData.investments && extractionData.investments.length > 0;
    updateUIFlow(hasData, false, true); // If we have data, dashboard must be connected
}

function updateStatus(elementId, text, className = '') {
    const element = elements[elementId];
    if (element) {
        element.textContent = text;
        element.className = `status-value ${className}`;
    }
}

function updateProgress(percent, message = '') {
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
    if (message) {
        elements.progressText.textContent = message;
    }
}

function showProgress(show = true) {
    elements.progressSection.style.display = show ? 'block' : 'none';
    // Show/hide cancel button with progress
    if (elements.cancelExtraction) {
        elements.cancelExtraction.style.display = show ? 'block' : 'none';
    }
}

function showResults(show = true) {
    elements.resultsSection.style.display = show ? 'block' : 'none';
}

function setButtonState(buttonId, enabled = true) {
    const button = elements[buttonId];
    if (button) {
        if (buttonId === 'clearAll') {
            // For clear button, enabled means visible, disabled means hidden
            button.style.display = enabled ? 'block' : 'none';
        } else {
            // For other buttons, just enable/disable
            button.disabled = !enabled;
        }
    }
}

function updateUIFlow(hasData = false, isReady = false, isConnected = false) {
    if (hasData) {
        // Data mode: Show data management buttons, hide extraction workflow
        setButtonVisibility('openDashboard', false);
        setButtonVisibility('checkLogin', false);
        setButtonVisibility('startExtraction', false);
        setButtonVisibility('downloadData', true);
        setButtonVisibility('viewData', true);
        setButtonVisibility('clearAll', true);
        // Enable data management buttons
        setButtonState('downloadData', true);
        setButtonState('viewData', true);
        setButtonState('clearAll', true);
        // Show sections when we have data
        setSectionVisibility('logSection', true);
        setSectionVisibility('resultsSection', true);
    } else if (isReady) {
        // Ready mode: Dashboard connected and logged in, show only start extraction
        setButtonVisibility('openDashboard', false);
        setButtonVisibility('checkLogin', false);
        setButtonVisibility('startExtraction', true);
        setButtonVisibility('downloadData', false);
        setButtonVisibility('viewData', false);
        setButtonVisibility('clearAll', false);
        // Enable start extraction button
        setButtonState('startExtraction', true);
        // Show sections when connected and ready
        setSectionVisibility('logSection', true);
        setSectionVisibility('resultsSection', false);
    } else if (isConnected) {
        // Connected but not ready mode: Show open dashboard for login
        setButtonVisibility('openDashboard', true);
        setButtonVisibility('checkLogin', false);
        setButtonVisibility('startExtraction', false);
        setButtonVisibility('downloadData', false);
        setButtonVisibility('viewData', false);
        setButtonVisibility('clearAll', false);
        // Enable open dashboard button
        setButtonState('openDashboard', true);
        // Show log section when connected
        setSectionVisibility('logSection', true);
        setSectionVisibility('resultsSection', false);
    } else {
        // Setup mode: Not connected, show only dashboard button
        setButtonVisibility('openDashboard', true);
        setButtonVisibility('checkLogin', false);
        setButtonVisibility('startExtraction', false);
        setButtonVisibility('downloadData', false);
        setButtonVisibility('viewData', false);
        setButtonVisibility('clearAll', false);
        // Enable open dashboard button
        setButtonState('openDashboard', true);
        // Hide sections when not connected
        setSectionVisibility('logSection', false);
        setSectionVisibility('resultsSection', false);
    }
}

function setButtonVisibility(buttonId, visible = true) {
    const button = elements[buttonId];
    if (button) {
        button.style.display = visible ? 'block' : 'none';
    }
}

function setSectionVisibility(sectionId, visible = true) {
    const section = elements[sectionId];
    if (section) {
        section.style.display = visible ? 'block' : 'none';
    }
}

// Send message to background script with timeout
async function sendMessage(action, payload = {}) {
    return new Promise((resolve) => {
        console.log(`Sending message: ${action}`);
        
        // Set a timeout for the message
        const timeout = setTimeout(() => {
            console.log(`Message ${action} timed out`);
            resolve({ success: false, error: 'Request timed out' });
        }, 30000); // 30 second timeout
        
        chrome.runtime.sendMessage({ action, ...payload }, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
                console.log(`Message ${action} error:`, chrome.runtime.lastError.message);
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log(`Message ${action} response:`, response);
                resolve(response || { success: false, error: 'No response' });
            }
        });
    });
}

// Event handlers
async function handleOpenDashboard() {
    addLog('Opening MicroLeap dashboard...');
    setButtonState('openDashboard', false);
    
    const response = await sendMessage('openDashboard');
    
    if (response.success) {
        updateStatus('dashboardStatus', 'Connected', 'success');
        updateStatus('loginStatus', response.isLoggedIn ? 'Logged in' : 'Login required', 
                    response.isLoggedIn ? 'success' : 'warning');
        
        addLog(response.message, response.isLoggedIn ? 'success' : 'warning');
        
        if (!response.isLoggedIn) {
            addLog('Please log in manually on the dashboard tab, then click "Verify Login"', 'warning');
        }
        
        // Use updateUIFlow to properly manage button states
        updateUIFlow(false, response.isLoggedIn, true);
    } else {
        updateStatus('dashboardStatus', 'Error', 'error');
        addLog(`Error: ${response.error}`, 'error');
        setButtonState('openDashboard', true);
    }
}

async function handleCheckLogin() {
    addLog('Checking login status...');
    setButtonState('checkLogin', false);
    
    const response = await sendMessage('checkLoginStatus');
    
    if (response.success) {
        updateStatus('loginStatus', response.isLoggedIn ? 'Logged in' : 'Login required', 
                    response.isLoggedIn ? 'success' : 'warning');
        
        addLog(response.message, response.isLoggedIn ? 'success' : 'warning');
        
        if (!response.isLoggedIn) {
            addLog('Please log in manually and try again', 'warning');
        }
        
        // Use updateUIFlow to properly manage button states
        updateUIFlow(false, response.isLoggedIn, true);
    } else {
        updateStatus('loginStatus', 'Error', 'error');
        addLog(`Error: ${response.error}`, 'error');
        setButtonState('checkLogin', true);
    }
}

async function handleStartExtraction() {
    // Clear all activity logs before starting extraction
    window.MicroLeapLogger.clearLogHistory();
    
    addLog('Initializing extraction...');
    completionProcessed = false; // Reset completion flag for new extraction
    setButtonState('startExtraction', false);
    setButtonState('downloadData', false);
    showProgress(true);
    showResults(false);
    updateProgress(0, 'Initializing extraction...');
    
    const response = await sendMessage('startExtraction');
    
    if (response.success) {
        if (response.data?.status === 'navigation_started') {
            // Navigation-based extraction started, wait for completion via message listener
            addLog('Navigation-based extraction started...', 'info');
            addLog('Browser will navigate through each investment page', 'info');
            // Don't hide progress or enable buttons yet
        } else {
            // Traditional extraction completed immediately
            extractionData = response.data;
            addLog(`Extraction completed! Found ${response.count} investments`, 'success');
            
            // Update results
            const investmentsWithSchedules = extractionData.investments?.filter(
                inv => inv.payment_schedule && inv.payment_schedule.length > 0
            ).length || 0;
            
            elements.investmentCount.textContent = response.count;
            elements.scheduleCount.textContent = investmentsWithSchedules;
            
            // Switch to data mode
            updateUIFlow(true, false, true);
            showResults(true);
            updateProgress(100, 'Extraction complete');
            showProgress(false);
        }
    } else {
        addLog(`Extraction failed: ${response.error}`, 'error');
        showProgress(false);
        // Stay in extraction mode on error - check connection status
        const dashboardResponse = await sendMessage('checkDashboard');
        const isConnected = dashboardResponse.success && dashboardResponse.isOpen;
        updateUIFlow(false, false, isConnected);
    }
}

function handleDownloadData() {
    if (!extractionData) {
        addLog('No data to download', 'error');
        return;
    }
    
    try {
        const dataStr = JSON.stringify(extractionData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `microleap-investments-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addLog('Data downloaded successfully', 'success');
    } catch (error) {
        addLog(`Download failed: ${error.message}`, 'error');
    }
}

function handleViewData() {
    if (!extractionData) {
        addLog('No data to view', 'error');
        return;
    }

    try {
        addLog('Opening data viewer...', 'info');
        showDataViewer();
        addLog('Data viewer opened', 'success');
    } catch (error) {
        console.error('Error opening data viewer:', error);
        addLog(`Failed to open data viewer: ${error.message}`, 'error');
    }
}

function handleOpenLogWindow() {
    try {
        addLog('Opening activity log...', 'info');
        showActivityLogModal();
        addLog('Activity log opened', 'success');
    } catch (error) {
        console.error('Error opening activity log:', error);
        addLog(`Failed to open activity log: ${error.message}`, 'error');
    }
}

function handleClearLog() {
    const confirmed = confirm(
        'Are you sure you want to clear all activity logs?\n\n' +
        'This action cannot be undone.'
    );
    
    if (confirmed) {
        try {
            // Clear from localStorage
            localStorage.removeItem('microleap_log_history');
            
            // Clear the visible log container
            if (elements.logContainer) {
                elements.logContainer.innerHTML = '';
            }
            
            // Reinitialize the shared logger
            window.MicroLeapLogger.clearLogHistory();
            
            addLog('Activity logs cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing logs:', error);
            addLog(`Failed to clear logs: ${error.message}`, 'error');
        }
    }
}

// Global variables for modal data display
let currentJsonData = null;
let isFormatted = true;

function showDataViewer() {
    currentJsonData = extractionData;
    const modal = document.getElementById('dataViewerModal');
    const jsonContent = document.getElementById('modalJsonContent');
    
    // Display formatted JSON by default
    isFormatted = true;
    displayModalJSON();
    
    // Setup modal event listeners
    setupModalEventListeners();
    
    // Show modal
    modal.style.display = 'flex';
    
    // Add escape key listener
    document.addEventListener('keydown', handleModalKeyDown);
}

function setupModalEventListeners() {
    // Close button
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDataViewer);
    }
    
    // Format buttons
    const formatBtn = document.getElementById('formatJsonBtn');
    if (formatBtn) {
        formatBtn.addEventListener('click', formatJSON);
    }
    
    const compactBtn = document.getElementById('compactJsonBtn');
    if (compactBtn) {
        compactBtn.addEventListener('click', compactJSON);
    }
    
    // Copy button
    const copyBtn = document.getElementById('copyModalBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyModalData);
    }
    
    // Click outside to close
    const modal = document.getElementById('dataViewerModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeDataViewer();
            }
        });
    }
}

function setupActivityLogModalEventListeners() {
    // Close button
    const closeBtn = document.getElementById('logModalCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeActivityLogModal);
    }
    
    // Click outside to close
    const modal = document.getElementById('activityLogModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeActivityLogModal();
            }
        });
    }
}

function closeDataViewer() {
    const modal = document.getElementById('dataViewerModal');
    modal.style.display = 'none';
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleModalKeyDown);
    
    // Remove modal event listeners to prevent memory leaks
    removeModalEventListeners();
}

function removeModalEventListeners() {
    // Close button
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeDataViewer);
    }
    
    // Format buttons
    const formatBtn = document.getElementById('formatJsonBtn');
    if (formatBtn) {
        formatBtn.removeEventListener('click', formatJSON);
    }
    
    const compactBtn = document.getElementById('compactJsonBtn');
    if (compactBtn) {
        compactBtn.removeEventListener('click', compactJSON);
    }
    
    // Copy button
    const copyBtn = document.getElementById('copyModalBtn');
    if (copyBtn) {
        copyBtn.removeEventListener('click', copyModalData);
    }
}

function handleModalKeyDown(event) {
    if (event.key === 'Escape') {
        closeDataViewer();
    }
}

function displayModalJSON() {
    const jsonContent = document.getElementById('modalJsonContent');
    if (currentJsonData) {
        const jsonString = isFormatted 
            ? JSON.stringify(currentJsonData, null, 2)
            : JSON.stringify(currentJsonData);
        
        jsonContent.textContent = jsonString;
        highlightModalJSON();
    }
}

function highlightModalJSON() {
    const jsonContent = document.getElementById('modalJsonContent');
    let html = jsonContent.textContent;
    
    // Basic JSON syntax highlighting
    html = html
        .replace(/("[\w_]+")(\s*:)/g, '<span class="json-key">$1</span>$2')
        .replace(/:\s*(".*?")/g, ': <span class="json-string">$1</span>')
        .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
        .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    
    jsonContent.innerHTML = html;
}

function formatJSON() {
    isFormatted = true;
    displayModalJSON();
}

function compactJSON() {
    isFormatted = false;
    displayModalJSON();
}

async function copyModalData(event) {
    if (!currentJsonData) return;
    
    try {
        const dataStr = JSON.stringify(currentJsonData, null, isFormatted ? 2 : 0);
        await navigator.clipboard.writeText(dataStr);
        
        // Show feedback on the button
        const btn = event ? event.target : document.getElementById('copyModalBtn');
        if (btn) {
            const originalText = btn.textContent;
            const originalBackground = btn.style.background;
            btn.textContent = '✅ Copied!';
            btn.style.background = '#10b981';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = originalBackground;
            }, 2000);
        }
        
        addLog('JSON data copied to clipboard', 'success');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        addLog('Failed to copy to clipboard', 'error');
    }
}

// Activity Log Modal Functions  
let modalLogEntries = [];

function showActivityLogModal() {
    const modal = document.getElementById('activityLogModal');
    modal.style.display = 'flex';
    
    // Load logs and start auto-refresh
    loadModalLogs();
    
    // Set up auto-refresh interval (clear any existing one first)
    if (window.modalLogInterval) {
        clearInterval(window.modalLogInterval);
    }
    window.modalLogInterval = setInterval(loadModalLogs, 1000);
}

function closeActivityLogModal() {
    const modal = document.getElementById('activityLogModal');
    modal.style.display = 'none';
    
    // Clear auto-refresh interval
    if (window.modalLogInterval) {
        clearInterval(window.modalLogInterval);
        window.modalLogInterval = null;
    }
}

function loadModalLogs() {
    try {
        const storedLogs = localStorage.getItem('microleap_log_history');
        if (storedLogs) {
            const logs = JSON.parse(storedLogs);
            if (JSON.stringify(logs) !== JSON.stringify(modalLogEntries)) {
                modalLogEntries = logs;
                renderModalLogs();
                updateModalStats();
            }
        }
    } catch (error) {
        console.error('Error loading modal logs:', error);
    }
}

function renderModalLogs() {
    const logContainer = document.getElementById('modalLogContainer');
    if (!logContainer) return;

    if (modalLogEntries.length === 0) {
        logContainer.innerHTML = `
            <div class="empty-log-state">
                <div class="empty-icon">📋</div>
                <p>No activity yet</p>
                <small>Logs will appear here when you start using the extension</small>
            </div>
        `;
        return;
    }

    const logHTML = modalLogEntries.map(log => {
        // Handle both 'type' (from shared logger) and 'logType' (legacy) fields
        const logType = log.logType || log.type || 'default';
        
        // Handle different timestamp formats properly
        let timeStr = '';
        if (log.time) {
            // Use existing time string if available (legacy)
            timeStr = log.time;
        } else if (log.timestamp) {
            // The timestamp field is already a formatted time string from shared logger
            timeStr = log.timestamp;
        } else if (log.fullTimestamp) {
            // Fallback to parsing the ISO timestamp
            try {
                const date = new Date(log.fullTimestamp);
                if (!isNaN(date.getTime())) {
                    timeStr = date.toLocaleTimeString();
                } else {
                    timeStr = 'Unknown';
                }
            } catch (e) {
                timeStr = 'Unknown';
            }
        } else {
            // No timestamp available
            timeStr = 'Unknown';
        }
        
        return `
            <div class="log-entry ${logType}">
                <span class="log-time">[${timeStr}]</span>
                <span class="log-message">${escapeHtml(log.message)}</span>
            </div>
        `;
    }).join('');

    logContainer.innerHTML = logHTML;

    // Auto-scroll to bottom (always enabled)
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateModalStats() {
    const logCount = document.getElementById('modalLogCount');
    
    if (logCount) {
        logCount.textContent = modalLogEntries.length;
    }
}



// Escape HTML to prevent XSS (reusing existing function name)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleCancelExtraction() {
    try {
        addLog('Cancelling extraction...', 'warning');
        
        // Send cancel message to background script
        const response = await sendMessage('cancelExtraction');
        if (response.success) {
            addLog('Extraction cancelled successfully', 'warning');
            
            // Hide progress and cancel button
            showProgress(false);
            elements.cancelExtraction.style.display = 'none';
            
            // Reset to ready state or extraction mode based on current connection
            const dashboardResponse = await sendMessage('checkDashboard');
            if (dashboardResponse.success && dashboardResponse.isOpen) {
                const loginResponse = await sendMessage('checkLoginStatus');
                if (loginResponse.success && loginResponse.isLoggedIn) {
                    // Switch to ready mode
                    updateUIFlow(false, true, true);
                } else {
                    // Switch to connected mode
                    updateUIFlow(false, false, true);
                }
            } else {
                // Switch to disconnected mode
                updateUIFlow(false, false, false);
            }
        } else {
            addLog(`Failed to cancel extraction: ${response.error}`, 'error');
        }
    } catch (error) {
        console.error('Error cancelling extraction:', error);
        addLog(`Error cancelling extraction: ${error.message}`, 'error');
    }
}

async function handleClearAll() {
    const confirmed = confirm(
        'This will permanently delete:\n' +
        '• All extracted investment data\n' +
        '• Complete activity log history\n' +
        '• Current extraction progress\n\n' +
        'Are you sure you want to continue?'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Clear extraction data via background script
        const response = await sendMessage('clearStoredData');
        if (response.success) {
            addLog('All extraction data cleared', 'warning');
        } else {
            addLog(`Failed to clear extraction data: ${response.error}`, 'error');
        }
        
        // Clear local state
        extractionData = null;
        
        // Switch to disconnected mode
        updateUIFlow(false, false, false);
        showResults(false);
        showProgress(false);
        updateStatus('dashboardStatus', 'Not connected', '');
        updateStatus('loginStatus', 'Unknown', 'unknown');
        
        // Clear activity log (this will add a final log entry)
        clearLogHistory();
        
        addLog('All data and logs cleared successfully', 'success');
        addLog('Extension reset to initial state', 'info');
        
    } catch (error) {
        addLog(`Error clearing data: ${error.message}`, 'error');
    }
}

// Track if we've already processed completion to avoid duplicates
let completionProcessed = false;
let lastProgressMessage = '';
let lastProgressTime = 0;
let lastLogMessage = '';
let lastLogTime = 0;

// Listen for background script updates
chrome.runtime.onMessage.addListener((message) => {
    console.log('Popup received message:', message.type, message);
    
    switch (message.type) {
        case 'logMessage':
            // Prevent duplicate log messages within 100ms
            const logNow = Date.now();
            if (message.message === lastLogMessage && (logNow - lastLogTime) < 100) {
                console.log('Duplicate log message ignored:', message.message);
                return;
            }
            lastLogMessage = message.message;
            lastLogTime = logNow;
            
            addLog(message.message, message.logType);
            break;
            
        case 'progressUpdate':
            // Prevent duplicate progress messages within 100ms
            const now = Date.now();
            if (message.message === lastProgressMessage && (now - lastProgressTime) < 100) {
                console.log('Duplicate progress message ignored:', message.message);
                return;
            }
            lastProgressMessage = message.message;
            lastProgressTime = now;
            
            updateProgress(message.progress, message.message);
            if (message.message) {
                addLog(message.message);
            }
            break;
            
        case 'extractionComplete':
            if (!completionProcessed) {
                completionProcessed = true;
                extractionData = message.data;
                updateProgress(100, 'Extraction complete');
                addLog(`Extraction completed! Found ${message.data.investments?.length || 0} investments`, 'success');
                
                // Switch to data mode
                updateUIFlow(true, false, true);
                showResults(true);
                showProgress(false); // Hide progress bar
                
                // Update results
                const count = message.data.investments?.length || 0;
                const withSchedules = message.data.investments?.filter(
                    inv => inv.payment_schedule && inv.payment_schedule.length > 0
                ).length || 0;
                
                elements.investmentCount.textContent = count;
                elements.scheduleCount.textContent = withSchedules;
                
                console.log('Extraction completion processed successfully');
            } else {
                console.log('Ignoring duplicate completion message');
            }
            break;
            
        case 'extractionError':
            completionProcessed = false; // Reset for next attempt
            addLog(`Extraction error: ${message.error}`, 'error');
            showProgress(false);
            // Stay in extraction mode on error - assume connected since extraction was attempted
            updateUIFlow(false, false, true);
            break;
    }
});

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize DOM elements after DOM is ready
    elements = {
        dashboardStatus: document.getElementById('dashboardStatus'),
        loginStatus: document.getElementById('loginStatus'),
        openDashboard: document.getElementById('openDashboard'),
        checkLogin: document.getElementById('checkLogin'),
        startExtraction: document.getElementById('startExtraction'),
        downloadData: document.getElementById('downloadData'),
        viewData: document.getElementById('viewData'),
        openLogWindow: document.getElementById('openLogWindow'),
        clearLogBtn: document.getElementById('clearLogBtn'),
        clearAll: document.getElementById('clearAll'),
        cancelExtraction: document.getElementById('cancelExtraction'),
        progressSection: document.querySelector('.progress-section'),
        progressText: document.getElementById('progressText'),
        progressPercent: document.getElementById('progressPercent'),
        progressFill: document.getElementById('progressFill'),
        logContainer: document.getElementById('logContainer'),
        logSection: document.querySelector('.log-section'),
        resultsSection: document.querySelector('.results-section'),
        investmentCount: document.getElementById('investmentCount'),
        scheduleCount: document.getElementById('scheduleCount')
    };
    
    // Debug: Check if all elements are found
    console.log('DOM elements found:', {
        openDashboard: !!elements.openDashboard,
        checkLogin: !!elements.checkLogin,
        startExtraction: !!elements.startExtraction,
        downloadData: !!elements.downloadData,
        viewData: !!elements.viewData,
        openLogWindow: !!elements.openLogWindow,
        clearLogBtn: !!elements.clearLogBtn,
        clearAll: !!elements.clearAll,
        cancelExtraction: !!elements.cancelExtraction
    });
    
    // Set up event listeners with safety checks
    if (elements.openDashboard) elements.openDashboard.addEventListener('click', handleOpenDashboard);
    if (elements.checkLogin) elements.checkLogin.addEventListener('click', handleCheckLogin);
    if (elements.startExtraction) elements.startExtraction.addEventListener('click', handleStartExtraction);
    if (elements.downloadData) elements.downloadData.addEventListener('click', handleDownloadData);
    if (elements.viewData) elements.viewData.addEventListener('click', handleViewData);
    if (elements.openLogWindow) elements.openLogWindow.addEventListener('click', handleOpenLogWindow);
    if (elements.clearLogBtn) elements.clearLogBtn.addEventListener('click', handleClearLog);
    
    // Add clear button listener with safety check
    if (elements.clearAll) {
        elements.clearAll.addEventListener('click', handleClearAll);
        console.log('Clear button event listener added');
    } else {
        console.error('Clear button element not found - checking if element exists in DOM');
        const clearBtn = document.getElementById('clearAll');
        console.log('Direct getElementById result:', clearBtn);
    }
    
    // Add cancel extraction button listener
    if (elements.cancelExtraction) {
        elements.cancelExtraction.addEventListener('click', handleCancelExtraction);
        console.log('Cancel extraction button event listener added');
    }
    
    // Initialize shared logger with log container
    window.MicroLeapLogger.initLogger(elements.logContainer);
    
    // Load persistent log history first
    loadLogHistory();
    
    // Initialize with welcome message if no logs exist
    const storedLogs = localStorage.getItem('microleap_log_history');
    if (!storedLogs) {
        addLog('Extension loaded. Click "Open Dashboard" to begin.');
    }
    
    // Add session separator if this is a new session
    const storedLogData = localStorage.getItem('microleap_log_history');
    const currentDate = new Date().toLocaleDateString();
    
    if (storedLogData) {
        const logs = JSON.parse(storedLogData);
        const lastSession = logs.length > 0 ? logs[logs.length - 1].date : null;
        
        if (lastSession && lastSession !== currentDate) {
            addLog(`--- New session (${currentDate}) ---`, 'info');
        } else if (logs.length > 0) {
            addLog('--- Extension reloaded ---', 'info');
        }
    }
    
    addLog('MicroLeap Data Extractor ready');
    
    // Check if we have existing extraction data
    const response = await sendMessage('getExtractionData');
    const storedLogCheck = localStorage.getItem('microleap_log_history');
    const hasLogHistory = storedLogCheck ? JSON.parse(storedLogCheck).length > 1 : false; // More than just the "ready" message
    
    if (response.success && response.data) {
        extractionData = response.data;
        
        const count = extractionData.investments?.length || 0;
        const withSchedules = extractionData.investments?.filter(
            inv => inv.payment_schedule && inv.payment_schedule.length > 0
        ).length || 0;
        
        // Check if extraction is still in progress
        if (extractionData.status === 'in_progress') {
            addLog(`Extraction in progress: ${extractionData.progress}/${extractionData.total} completed`, 'info');
            showProgress(true);
            updateProgress(
                Math.round((extractionData.progress / extractionData.total) * 100), 
                `Processing ${extractionData.progress}/${extractionData.total} investments`
            );
            // During extraction, show extraction buttons but disabled (connected by definition)
            updateUIFlow(false, false, true);
            setButtonState('openDashboard', false);
            setButtonState('checkLogin', false);
            setButtonState('startExtraction', false);
        } else if (extractionData.status === 'cancelled') {
            const cancelTime = extractionData.cancelled_at ? 
                new Date(extractionData.cancelled_at).toLocaleTimeString() : 'recently';
            addLog(`Previous extraction was cancelled at ${cancelTime}`, 'warning');
            showProgress(false);
            // If we have partial data, show it in data mode
            if (count > 0) {
                updateUIFlow(true, false, true);
                showResults(true);
            } else {
                // No data - determine connection status
                updateUIFlow(false, false, false);
            }
        } else if (extractionData.status === 'completed') {
            addLog(`Previous extraction completed: ${count} investments found`, 'success');
            showProgress(false);
            // Switch to data mode (connected by definition if we have data)
            updateUIFlow(true, false, true);
        } else {
            addLog('Previous extraction data available', 'info');
            // Switch to data mode (connected by definition if we have data)
            updateUIFlow(true, false, true);
        }
        
        // Update results display
        elements.investmentCount.textContent = count;
        elements.scheduleCount.textContent = withSchedules;
        showResults(true);
    } else {
        // No data - the auto-validation will determine connection status
        // Start with disconnected state, auto-validation will update if needed
        updateUIFlow(false, false, false);
    }
    
    // Setup activity log modal event listeners
    setupActivityLogModalEventListeners();
    
    // Auto-validate dashboard and login status on popup open
    await autoValidateStatus();
});

async function autoValidateStatus() {
    try {
        addLog('Checking dashboard connection...', 'info');
        
        // Check if we already have extraction data - if so, don't override the data mode UI
        const hasData = extractionData && extractionData.investments && extractionData.investments.length > 0;
        
        // Check if dashboard is already open
        const dashboardResponse = await sendMessage('checkDashboard');
        if (dashboardResponse.success) {
            if (dashboardResponse.isOpen) {
                updateStatus('dashboardStatus', 'Connected', 'success');
                setButtonState('checkLogin', true);
                addLog('Dashboard already connected', 'success');
                
                // Auto-check login status if dashboard is connected
                addLog('Verifying login status...', 'info');
                const loginResponse = await sendMessage('checkLoginStatus');
                if (loginResponse.success) {
                    if (loginResponse.isLoggedIn) {
                        updateStatus('loginStatus', 'Logged in', 'success');
                        addLog('Login verified successfully', 'success');
                        
                        // Only update UI flow if we don't have data (don't override data mode)
                        if (!hasData) {
                            // Switch to ready mode: connected and logged in
                            updateUIFlow(false, true, true);
                            addLog('Ready for extraction! Click "Start Extraction" to begin.', 'success');
                        } else {
                            addLog('Previous extraction data is available for download', 'info');
                        }
                    } else {
                        updateStatus('loginStatus', 'Not logged in', 'error');
                        addLog('Please log in to MicroLeap dashboard', 'warning');
                        addLog('Click "Open Dashboard" to log in manually', 'info');
                        // Only update UI flow if we don't have data
                        if (!hasData) {
                            // Connected but not logged in
                            updateUIFlow(false, false, true);
                        }
                    }
                } else {
                    updateStatus('loginStatus', 'Check failed', 'error');
                    addLog(`Login check failed: ${loginResponse.error}`, 'error');
                    addLog('Click "Open Dashboard" to check login manually', 'info');
                    // Only update UI flow if we don't have data
                    if (!hasData) {
                        // Connected but login check failed
                        updateUIFlow(false, false, true);
                    }
                }
            } else {
                updateStatus('dashboardStatus', 'Not connected', 'error');
                addLog('Dashboard not open. Click "Open Dashboard" to connect.', 'info');
                // Only update UI flow if we don't have data
                if (!hasData) {
                    // Not connected - hide sections
                    updateUIFlow(false, false, false);
                }
            }
        } else {
            updateStatus('dashboardStatus', 'Check failed', 'error');
            addLog(`Dashboard check failed: ${dashboardResponse.error}`, 'error');
            // Only update UI flow if we don't have data
            if (!hasData) {
                // Check failed - treat as not connected
                updateUIFlow(false, false, false);
            }
        }
    } catch (error) {
        console.error('Auto-validation error:', error);
        addLog('Auto-validation failed. Please check manually.', 'warning');
    }
}
