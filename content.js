// MicroLeap Investment Data Extractor - Content Script

const scriptInstanceId = Math.random().toString(36).substring(7);
console.log(`MicroLeap Data Extractor content script loaded [Instance: ${scriptInstanceId}]`);

// Utility function to wait
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Send progress update to background script
function sendProgress(progress, message) {
    console.log(`[${scriptInstanceId}] Sending progress: ${message}`);
    chrome.runtime.sendMessage({
        type: 'progressUpdate',
        progress: Math.round(progress),
        message: message
    });
}

// Global queue for ALL log messages to ensure sequential display
let globalLogQueue = [];
let isProcessingGlobalQueue = false;

// Helper function to send logs to popup via message passing with delay
function addLog(message, type = 'info') {
    try {
        console.log(`[${scriptInstanceId}] [${type.toUpperCase()}] ${message}`);
        
        // Add to global queue for sequential processing
        globalLogQueue.push({ message, type, timestamp: Date.now() });
        
        // Debug: Log queue size
        if (globalLogQueue.length > 1) {
            console.log(`[QUEUE] Added to queue. Queue size: ${globalLogQueue.length}`);
        }
        
        // Process queue without waiting (non-blocking)
        if (!isProcessingGlobalQueue) {
            processGlobalLogQueue();
        }
    } catch (error) {
        console.error('Error in addLog:', error);
        console.log(`[FALLBACK] ${message}`);
    }
}

// Process global log queue with delays for smooth one-by-one display
async function processGlobalLogQueue() {
    if (isProcessingGlobalQueue) {
        return;
    }
    
    isProcessingGlobalQueue = true;
    
    while (globalLogQueue.length > 0) {
        const { message, type } = globalLogQueue.shift();
        
        try {
            chrome.runtime.sendMessage({
                type: 'logMessage',
                message: message,
                logType: type
            }).catch(() => {
                console.log(`[FALLBACK] ${message}`);
            });
            
            // Wait 300ms before sending next message for smooth visual flow
            await sleep(300);
            
        } catch (error) {
            console.log(`[FALLBACK] ${message}`);
            await sleep(300); // Still wait even on error to maintain timing
        }
    }
    
    isProcessingGlobalQueue = false;
}

// Send completion message to background script (once only)
let completionSent = false;
function sendComplete(data) {
    if (!completionSent) {
        completionSent = true;
        console.log('Sending extraction completion with', data.investments?.length, 'investments');
        chrome.runtime.sendMessage({
            type: 'extractionComplete',
            data: data
        });
    }
}

// Send error message to background script
function sendError(error) {
    chrome.runtime.sendMessage({
        type: 'extractionError',
        error: error
    });
}

// Wait for an element to appear
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

// Wait for page to fully load
function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve, { once: true });
        }
    });
}

// Set page size to maximum to get all investments
async function setPageSizeToMaximum() {
    try {
        // Prevent duplicate calls during the same extraction session
        if (pageSizeAlreadySet) {
            //console.log('Page size already set, skipping...');
            return;
        }
        
        // Only show progress message when actually setting the page size
        if (window.location.pathname.includes('/investment/me')) {
            //sendProgress(5, 'Setting page size to maximum...');
            pageSizeAlreadySet = true; // Mark as set to prevent duplicates
        }
        
        // Wait for the page size selector to appear
        await waitForElement('select', 5000);
        await sleep(500);
        
        const pageSelector = document.querySelector('select');
        if (pageSelector) {
            // Find the highest value option (usually 1000)
            const options = Array.from(pageSelector.options);
            const maxOption = options.reduce((max, option) => {
                const value = parseInt(option.value);
                return value > parseInt(max.value) ? option : max;
            });
            
            if (maxOption && pageSelector.value !== maxOption.value) {
                pageSelector.value = maxOption.value;
                pageSelector.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(500); // Wait for page to reload with new page size
            }
        }
    } catch (error) {
        console.warn('Could not set page size:', error.message);
        // Continue anyway as this is not critical
    }
}

// Extract investment list from the current page
function extractInvestmentList() {
    sendProgress(10, 'Extracting investment list...');
    
    const investments = [];
    const rows = document.querySelectorAll('table tbody tr');
    
    rows.forEach((row, index) => {
        try {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                const id = cells[1]?.textContent?.trim() || '';
                const note = cells[2]?.textContent?.trim() || '';
                const status = cells[3]?.textContent?.trim() || '';
                const amount = cells[4]?.textContent?.trim() || '';
                
                if (id) {
                    investments.push({
                        id: id,
                        note: note,
                        status: status,
                        amount: amount,
                        rowIndex: index
                    });

                    addLog('extracting investment list:'+ id + ': ' + note + ': ' + status + ': ' + amount, 'info');
                }
            }
        } catch (error) {
            console.warn(`Error extracting row ${index}:`, error);
        }
    });
    
    console.log(`Found ${investments.length} investments in list`);
    return investments;
}

// Extract data from investment details page
function extractInvestmentDetails() {
    console.log('🔍 extractInvestmentDetails() called');
    const details = {};
    const tables = document.querySelectorAll('table');
    
    console.log('Found', tables.length, 'tables on page');
    if (tables.length === 0) {
        throw new Error('No tables found on investment details page');
    }
    
    // Extract details from the first (or main) table
    const detailsTable = tables[0];
    const rows = detailsTable.querySelectorAll('tr');
    
    console.log('Processing', rows.length, 'rows from details table');
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
            const label = cells[0]?.textContent?.trim() || '';
            const value = cells[2]?.textContent?.trim() || '';
            
            console.log(`Row ${index}: label="${label}", value="${value}"`);
            if (label && value) {
                // Convert label to snake_case key
                const key = label.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '_');
                details[key] = value;
                
                // Log the extraction details
                console.log('🔄 Adding detail log to queue:', label, ':', value);
                addLog('extracting details: ' + label + ': ' + value, 'info');
            }
        }
    });
    
    return details;
}

// Extract payment schedule from the second table
function extractPaymentSchedule() {
    console.log('💰 extractPaymentSchedule() called');
    const tables = document.querySelectorAll('table');
    
    console.log('Found', tables.length, 'tables for payment schedule');
    if (tables.length < 2) {
        console.warn('Payment schedule table not found');
        return [];
    }
    
    const scheduleTable = tables[1];
    const rows = scheduleTable.querySelectorAll('tbody tr');
    const schedule = [];
    
    rows.forEach((row, index) => {
        try {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 11) {
                // Extract payment date from cell that might contain additional text
                const dateCell = cells[1];
                const dateText = dateCell.textContent?.trim() || '';
                let paymentDate = dateText;
                
                // If date is in format like "Month X (DD/MM/YYYY)", extract the date part
                const dateMatch = dateText.match(/\(([^)]+)\)/);
                if (dateMatch) {
                    paymentDate = dateMatch[1];
                }
                
                const payment = {
                    payment_date: paymentDate,
                    repayment_status: cells[2]?.textContent?.trim() || '',
                    action: cells[3]?.textContent?.trim() || '',
                    investor_fee: cells[4]?.textContent?.trim() || '',
                    total_returns: cells[5]?.textContent?.trim() || '',
                    principal_due: cells[6]?.textContent?.trim() || '',
                    profit_due: cells[7]?.textContent?.trim() || '',
                    total_paid: cells[8]?.textContent?.trim() || '',
                    withholding_tax: cells[9]?.textContent?.trim() || '',
                    total_settled: cells[10]?.textContent?.trim() || ''
                };
                
                schedule.push(payment);
                
                // Log payment schedule entry
                console.log('💳 Adding payment log to queue:', `Payment ${index + 1}: ${paymentDate}`);
                addLog(`Payment ${index + 1}: ${paymentDate} - Status: ${payment.repayment_status} - Total: ${payment.total_settled}`, 'info');
            }
        } catch (error) {
            console.warn(`Error extracting payment row ${index}:`, error);
        }
    });
    
    return schedule;
}

// Fetch and parse HTML from a URL
async function fetchInvestmentPage(investmentId) {
    const url = `https://dashboard.microleapasia.com/investment/${investmentId}`;
    console.log(`📡 Fetching URL: ${url}`);
    
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`📄 Received HTML (${html.length} chars) for investment ${investmentId}`);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Check if we got a valid page with tables
        const tables = doc.querySelectorAll('table');
        console.log(`📋 Found ${tables.length} tables in fetched page for ${investmentId}`);
        
        return doc;
    } catch (error) {
        console.error(`❌ Error fetching investment ${investmentId}:`, error);
        throw error;
    }
}

// Navigate to investment page and extract data
async function extractSingleInvestment(investment, index, total) {
    const progressBase = 20 + (index / total) * 70; // Progress from 20% to 90%
    
    sendProgress(progressBase, `Processing investment ${index + 1}/${total}: ${investment.id}`);
    console.log(`🔍 Starting extraction for investment ${investment.id}`);
    
    try {
        // Navigate to the investment details page
        const investmentUrl = `https://dashboard.microleapasia.com/investment/${investment.id}`;
        console.log(`🌐 Navigating to: ${investmentUrl}`);
        
        // Navigate to the page
        window.location.href = investmentUrl;
        
        // Wait for page to load
        await waitForPageLoad();
        console.log(`✅ Page loaded for investment ${investment.id}`);
        
        // Wait a bit more for dynamic content
        await sleep(500);
        
        // Extract data from current page
        const details = extractInvestmentDetails();
        const paymentSchedule = extractPaymentSchedule();
        
        console.log(`✅ Extracted ${Object.keys(details).length} detail fields and ${paymentSchedule.length} payments for ${investment.id}`);
        
        // Combine all data
        const result = {
            id: investment.id,
            note: investment.note,
            status: investment.status,
            amount: investment.amount,
            note_reference: details.investment_note_reference || '',
            note_type: details.note_type || '',
            tenor: details.tenor || '',
            credit_risk_rating: details.credit_risk_rating || '',
            investment_amount: details.investment_amount || investment.amount,
            profit_rate: details.profit_rate || '',
            total_profit: details.total_profit || '',
            total_gross_return: details.total_gross_return_on_investment || '',
            investor_fee: details.investor_fee || '',
            withholding_tax: details.withholding_tax || '',
            total_net_returns: details.total_net_returns_on_investment || '',
            pledged_on: details.pledged_on || '',
            disbursed_on: details.disbursed_on || '',
            payment_schedule: paymentSchedule
        };
        
        console.log(`Successfully extracted data for investment ${investment.id}`);
        return result;
        
    } catch (error) {
        console.error(`Error processing investment ${investment.id}:`, error);
        
        // Return basic data even if detailed extraction fails
        return {
            id: investment.id,
            note: investment.note,
            status: investment.status,
            amount: investment.amount,
            error: error.message,
            payment_schedule: []
        };
    }
}

// Main extraction function
async function performExtraction() {
    try {
        // Reset completion flag for new extraction
        completionSent = false;
        pageSizeAlreadySet = false; // Reset page size flag for new extraction
        extractionCancelled = false; // Reset cancellation flag for new extraction
        console.log('🚀 Starting new extraction process...');
        
        // Ensure we're on the investment list page
        if (!window.location.pathname.includes('/investment/me')) {
            // Check for cancellation before navigating to investment list
            if (extractionCancelled) {
                console.log('🛑 Extraction cancelled before navigating to investment list, stopping...');
                return { status: 'cancelled' };
            }
            
            window.location.href = 'https://dashboard.microleapasia.com/investment/me';
            await sleep(500);
            
            // Check for cancellation after navigating to investment list
            if (extractionCancelled) {
                console.log('🛑 Extraction cancelled after navigating to investment list, stopping...');
                return { status: 'cancelled' };
            }
        }
        
        await sleep(500); // Wait for page to load
        
        // Check for cancellation after page load
        if (extractionCancelled) {
            console.log('🛑 Extraction cancelled during page load, stopping...');
            return { status: 'cancelled' };
        }
        
        // Set page size to maximum to get all investments
        await setPageSizeToMaximum();
        
        // Check for cancellation after setting page size
        if (extractionCancelled) {
            console.log('🛑 Extraction cancelled after page size setup, stopping...');
            return { status: 'cancelled' };
        }
        
        // Extract investment list
        const investmentList = extractInvestmentList();
        
        // Check for cancellation after extracting investment list
        if (extractionCancelled) {
            console.log('🛑 Extraction cancelled after investment list extraction, stopping...');
            return { status: 'cancelled' };
        }
        
        if (investmentList.length === 0) {
            throw new Error('No investments found in the list');
        }
        
        sendProgress(15, `Found ${investmentList.length} investments. Extracting details...`);
        
        // Check for cancellation before starting navigation
        if (extractionCancelled) {
            console.log('🛑 Extraction cancelled before navigation, stopping...');
            return { status: 'cancelled' };
        }
        
        // For navigation-based extraction, we need to start the sequential process
        // Save state for continuation after navigation
        isInitialExtraction = true; // Mark this as initial extraction
        const extractionState = {
            investmentList: investmentList,
            currentIndex: 0,
            detailedInvestments: [],
            startTime: Date.now()
        };
        
        // Check for cancellation before saving state
        if (extractionCancelled) {
            console.log('🛑 Extraction cancelled before saving state, stopping...');
            return { status: 'cancelled' };
        }
        
        localStorage.setItem('microleap_extraction_state', JSON.stringify(extractionState));
        
        // Navigate to the first investment to start the process
        if (investmentList.length > 0) {
            // Final check before navigation
            if (extractionCancelled) {
                console.log('🛑 Extraction cancelled before navigation, stopping...');
                localStorage.removeItem('microleap_extraction_state');
                return { status: 'cancelled' };
            }
            
            const firstInvestment = investmentList[0];
            sendProgress(20, `Navigating to first investment: ${firstInvestment.id}`);
            
            // Navigate to first investment page
            window.location.href = `https://dashboard.microleapasia.com/investment/${firstInvestment.id}`;
            
            // Clear the initial extraction flag after navigation starts
            setTimeout(() => {
                isInitialExtraction = false;
            }, 1000);
            
            // Return a placeholder result since the real completion will happen via navigation
            return {
                extraction_date: new Date().toISOString(),
                total_investments: 0,
                investments_with_schedules: 0,
                investments: [],
                status: 'navigation_started'
            };
        } else {
            throw new Error('No investments to process');
        }
        
    } catch (error) {
        console.error('Extraction failed:', error);
        sendError(error.message);
        throw error;
    }
}

// Flag to prevent duplicate extraction processing
let extractionInProgress = false;
let isInitialExtraction = false;
let pageSizeAlreadySet = false;
let extractionCancelled = false;

// Continue extraction after page navigation
async function continueExtraction() {
    try {
        if (extractionCancelled) {
            console.log('🛑 Extraction was cancelled, not continuing...');
            return;
        }
        
        if (extractionInProgress) {
            console.log('Extraction already in progress, skipping...');
            return;
        }
        
        if (isInitialExtraction) {
            console.log('Initial extraction in progress, skipping continuation...');
            return;
        }
        
        const stateStr = localStorage.getItem('microleap_extraction_state');
        if (!stateStr) {
            console.log('No extraction state found');
            return;
        }
        
        // IMPORTANT: Double check that extraction state still exists (not cancelled)
        if (!localStorage.getItem('microleap_extraction_state')) {
            console.log('🛑 Extraction was cancelled, stopping...');
            return;
        }
        
        extractionInProgress = true;
        
        const extractionState = JSON.parse(stateStr);
        const currentPath = window.location.pathname;
        
        console.log('Checking extraction continuation...', { currentPath, state: extractionState });
        
        // Check if we're on an individual investment page
        if (currentPath.startsWith('/investment/') && currentPath !== '/investment/me') {
            const currentInvestment = extractionState.investmentList[extractionState.currentIndex];
            
            if (currentInvestment) {
                console.log(`Extracting data for investment ${currentInvestment.id} (${extractionState.currentIndex + 1}/${extractionState.investmentList.length})`);
                addLog(`Starting extraction for investment ${currentInvestment.id} (${extractionState.currentIndex + 1}/${extractionState.investmentList.length})`, 'info');
                
                // Check for cancellation before processing
                if (!localStorage.getItem('microleap_extraction_state')) {
                    console.log('🛑 Extraction cancelled before processing, stopping...');
                    extractionInProgress = false;
                    return;
                }
                
                // Wait for page to load
                await sleep(500);
                
                // Check for cancellation after page load
                if (!localStorage.getItem('microleap_extraction_state')) {
                    console.log('🛑 Extraction cancelled after page load, stopping...');
                    extractionInProgress = false;
                    return;
                }
                
                // Extract data from current page
                console.log('🚀 CHECKPOINT 1: About to call addLog for extraction details...');
                
                // Temporarily use direct message sending instead of queue
                chrome.runtime.sendMessage({
                    type: 'logMessage',
                    message: `Extracting details for investment ${currentInvestment.id}`,
                    logType: 'info'
                }).catch(() => console.log('Direct message failed'));
                
                console.log('🚀 CHECKPOINT 2: After direct message, about to start extraction functions...');
                
                let details = {};
                let paymentSchedule = [];
                
                try {
                    console.log('About to call extractInvestmentDetails()...');
                    
                    // Inline extraction to debug
                    console.log('🔍 Starting inline detail extraction...');
                    const tables = document.querySelectorAll('table');
                    console.log('Found', tables.length, 'tables on page');
                    
                    if (tables.length > 0) {
                        const detailsTable = tables[0];
                        const rows = detailsTable.querySelectorAll('tr');
                        console.log('Processing', rows.length, 'rows from details table');
                        
                        rows.forEach((row, index) => {
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 3) {
                                const label = cells[0]?.textContent?.trim() || '';
                                const value = cells[2]?.textContent?.trim() || '';
                                
                                if (label && value) {
                                    const key = label.toLowerCase()
                                        .replace(/[^a-z0-9\s]/g, '')
                                        .replace(/\s+/g, '_');
                                    details[key] = value;
                                    
                                    console.log('🔄 Sending direct detail log:', label, ':', value);
                                    chrome.runtime.sendMessage({
                                        type: 'logMessage',
                                        message: 'extracting details: ' + label + ': ' + value,
                                        logType: 'info'
                                    }).catch(() => console.log('Direct detail message failed'));
                                }
                            }
                        });
                    }
                    
                    console.log('Details extracted:', Object.keys(details).length, 'fields');
                } catch (error) {
                    console.error('Error in extractInvestmentDetails:', error);
                    chrome.runtime.sendMessage({
                        type: 'logMessage',
                        message: `Error extracting details: ${error.message}`,
                        logType: 'error'
                    }).catch(() => console.log('Direct error message failed'));
                }
                
                try {
                    chrome.runtime.sendMessage({
                        type: 'logMessage',
                        message: `Extracting payment schedule for investment ${currentInvestment.id}`,
                        logType: 'info'
                    }).catch(() => console.log('Direct payment schedule message failed'));
                    
                    console.log('About to extract payment schedule inline...');
                    
                    // Inline payment schedule extraction to avoid queue issues
                    const tables = document.querySelectorAll('table');
                    if (tables.length >= 2) {
                        const scheduleTable = tables[1];
                        const rows = scheduleTable.querySelectorAll('tbody tr');
                        console.log('Processing', rows.length, 'payment rows');
                        
                        rows.forEach((row, index) => {
                            try {
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 11) {
                                    const dateCell = cells[1];
                                    const dateText = dateCell.textContent?.trim() || '';
                                    let paymentDate = dateText;
                                    
                                    const dateMatch = dateText.match(/\(([^)]+)\)/);
                                    if (dateMatch) {
                                        paymentDate = dateMatch[1];
                                    }
                                    
                                    const payment = {
                                        payment_date: paymentDate,
                                        repayment_status: cells[2]?.textContent?.trim() || '',
                                        action: cells[3]?.textContent?.trim() || '',
                                        investor_fee: cells[4]?.textContent?.trim() || '',
                                        total_returns: cells[5]?.textContent?.trim() || '',
                                        principal_due: cells[6]?.textContent?.trim() || '',
                                        profit_due: cells[7]?.textContent?.trim() || '',
                                        total_paid: cells[8]?.textContent?.trim() || '',
                                        withholding_tax: cells[9]?.textContent?.trim() || '',
                                        total_settled: cells[10]?.textContent?.trim() || ''
                                    };
                                    
                                    paymentSchedule.push(payment);
                                    
                                    console.log('💳 Sending direct payment log:', `Payment ${index + 1}: ${paymentDate}`);
                                    chrome.runtime.sendMessage({
                                        type: 'logMessage',
                                        message: `Payment ${index + 1}: ${paymentDate} - Status: ${payment.repayment_status} - Total: ${payment.total_settled}`,
                                        logType: 'info'
                                    }).catch(() => console.log('Direct payment message failed'));
                                }
                            } catch (error) {
                                console.warn(`Error extracting payment row ${index}:`, error);
                            }
                        });
                    } else {
                        console.warn('Payment schedule table not found');
                    }
                    console.log('Payment schedule extracted:', paymentSchedule.length, 'entries');
                } catch (error) {
                    console.error('Error in extractPaymentSchedule:', error);
                    chrome.runtime.sendMessage({
                        type: 'logMessage',
                        message: `Error extracting payment schedule: ${error.message}`,
                        logType: 'error'
                    }).catch(() => console.log('Direct payment error message failed'));
                }
                
                // Log extraction results
                const detailCount = Object.keys(details).length;
                const paymentCount = paymentSchedule ? paymentSchedule.length : 0;
                chrome.runtime.sendMessage({
                    type: 'logMessage',
                    message: `Found ${detailCount} detail fields and ${paymentCount} payment entries for ${currentInvestment.id}`,
                    logType: 'success'
                }).catch(() => console.log('Direct summary message failed'));
                
                // Check for cancellation after data extraction
                if (!localStorage.getItem('microleap_extraction_state')) {
                    console.log('🛑 Extraction cancelled after data extraction, stopping...');
                    extractionInProgress = false;
                    return;
                }
                
                // Combine data
                const investmentData = {
                    ...currentInvestment,
                    ...details,
                    payment_schedule: paymentSchedule
                };
                
                // Add to results
                extractionState.detailedInvestments.push(investmentData);
                extractionState.currentIndex++;
                
                // Save extracted data persistently to localStorage
                const persistentData = {
                    extraction_date: extractionState.startTime ? new Date(extractionState.startTime).toISOString() : new Date().toISOString(),
                    total_investments: extractionState.detailedInvestments.length,
                    investments_with_schedules: extractionState.detailedInvestments.filter(inv => 
                        inv.payment_schedule && inv.payment_schedule.length > 0
                    ).length,
                    investments: extractionState.detailedInvestments,
                    status: 'in_progress',
                    progress: extractionState.currentIndex,
                    total: extractionState.investmentList.length
                };
                
                // Save both extraction state and final data
                localStorage.setItem('microleap_extraction_data', JSON.stringify(persistentData));
                localStorage.setItem('microleap_extraction_state', JSON.stringify(extractionState));
                
                console.log(`💾 Saved ${extractionState.detailedInvestments.length} investments to localStorage`);
                
                // Update progress
                const progress = 20 + (extractionState.currentIndex / extractionState.investmentList.length) * 70;
                sendProgress(progress, `Completed ${extractionState.currentIndex}/${extractionState.investmentList.length} investments`);
                
                // Check if we're done
                if (extractionState.currentIndex >= extractionState.investmentList.length) {
                    // All done! Update final result
                    persistentData.status = 'completed';
                    persistentData.completion_date = new Date().toISOString();
                    localStorage.setItem('microleap_extraction_data', JSON.stringify(persistentData));
                    
                    sendProgress(100, 'Extraction completed successfully!');
                    sendComplete(persistentData);
                    
                    // Clean up state but keep data
                    localStorage.removeItem('microleap_extraction_state');
                    
                    console.log('Extraction completed!', persistentData);
                    console.log('💾 Final data saved to localStorage as microleap_extraction_data');
                    extractionInProgress = false;
                    return;
                }
                
                // Check if extraction was cancelled before navigating to next
                if (!localStorage.getItem('microleap_extraction_state')) {
                    console.log('🛑 Extraction cancelled, stopping navigation...');
                    extractionInProgress = false;
                    return;
                }
                
                // Navigate to next investment
                const nextInvestment = extractionState.investmentList[extractionState.currentIndex];
                console.log(`Navigating to next investment: ${nextInvestment.id}`);
                
                // Reset flag before navigation so it can process the next page
                extractionInProgress = false;
                
                window.location.href = `https://dashboard.microleapasia.com/investment/${nextInvestment.id}`;
            }
        } else {
            extractionInProgress = false;
        }
    } catch (error) {
        console.error('Error continuing extraction:', error);
        extractionInProgress = false;
        sendError(error.message);
        localStorage.removeItem('microleap_extraction_state');
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startExtraction') {
        performExtraction()
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // Keep message channel open for async response
    }
    
    if (message.action === 'getStoredData') {
        try {
            const storedData = localStorage.getItem('microleap_extraction_data');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                console.log('📤 Retrieved stored data from localStorage:', parsedData);
                sendResponse({ success: true, data: parsedData });
            } else {
                sendResponse({ success: false, error: 'No stored data found' });
            }
        } catch (error) {
            console.error('Error retrieving stored data:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    if (message.action === 'clearStoredData') {
        try {
            localStorage.removeItem('microleap_extraction_data');
            localStorage.removeItem('microleap_extraction_state');
            console.log('🗑️ Cleared all stored extraction data');
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error clearing stored data:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    if (message.action === 'cancelExtraction') {
        try {
            console.log('🛑 Cancelling extraction...');
            
            // Set cancellation flag immediately to prevent any further processing
            extractionCancelled = true;
            
            // Set extraction flag to false to stop ongoing processes
            extractionInProgress = false;
            
            // Clear extraction state
            localStorage.removeItem('microleap_extraction_state');
            
            // Update extraction data status to cancelled instead of deleting it
            const existingData = localStorage.getItem('microleap_extraction_data');
            if (existingData) {
                try {
                    const data = JSON.parse(existingData);
                    data.status = 'cancelled';
                    data.cancelled_at = new Date().toISOString();
                    localStorage.setItem('microleap_extraction_data', JSON.stringify(data));
                    console.log('📝 Updated extraction data status to cancelled');
                } catch (error) {
                    console.warn('Error updating extraction data status:', error);
                }
            }
            
            // Reset completion flag
            completionSent = false;
            pageSizeAlreadySet = false; // Reset page size flag
            
            console.log('🛑 Extraction cancelled and state cleared');
            sendResponse({ success: true, message: 'Extraction cancelled' });
        } catch (error) {
            console.error('Error cancelling extraction:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// Check if we need to continue extraction on page load
window.addEventListener('load', () => {
    console.log('Page loaded, checking for extraction continuation...');
    setTimeout(continueExtraction, 2000); // Wait a bit for page to settle
});
