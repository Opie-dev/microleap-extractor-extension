# MicroLeap Investment Data Extractor

A Chrome extension for extracting investment data from the [MicroLeap Asia dashboard](https://dashboard.microleapasia.com/).

## Features

✅ **Automated Navigation** - Opens and navigates to the MicroLeap dashboard  
✅ **Login Detection** - Detects if you're logged in and prompts for manual login if needed  
✅ **Investment List Extraction** - Extracts all investments from `/investment/me`  
✅ **Detailed Data Extraction** - Gets detailed info from each `/investment/{id}` page  
✅ **Payment Schedule Extraction** - Extracts payment schedules from investment detail tables  
✅ **Progress Tracking** - Shows real-time progress during extraction  
✅ **JSON Export** - Downloads extracted data as a structured JSON file  

## Installation

### Method 1: Load Unpacked Extension (Recommended for Development)

1. **Download the Extension**
   - Clone or download this repository
   - Navigate to the `extension/` folder

2. **Open Chrome Extensions**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `extension/` folder
   - The extension should now appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Find "MicroLeap Investment Data Extractor"
   - Click the pin icon to keep it visible

### Method 2: Create ZIP Package

1. **Package the Extension**
   ```bash
   cd extension/
   zip -r microleap-extractor.zip *
   ```

2. **Load in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Drag and drop the ZIP file onto the page

## Usage

### Step 1: Open Dashboard
1. Click the extension icon in your Chrome toolbar
2. Click "🌐 Open Dashboard" button
3. The extension will open https://dashboard.microleapasia.com/

### Step 2: Login (if needed)
1. If redirected to login page, log in manually in the opened tab
2. Return to the extension popup
3. Click "✅ Verify Login" to confirm you're logged in

### Step 3: Extract Data
1. Click "🚀 Start Extraction" button
2. The extension will:
   - Navigate to `/investment/me`
   - Set page size to maximum (1000 entries)
   - Extract the investment list
   - Loop through each investment to get detailed data
   - Extract payment schedules from each investment

### Step 4: Download Results
1. Wait for extraction to complete (progress bar will show 100%)
2. Click "💾 Download Data" button
3. A JSON file will be downloaded with all extracted data

## Data Structure

The extracted JSON file contains:

```json
{
  "extraction_date": "2024-01-15T10:30:00.000Z",
  "total_investments": 25,
  "investments_with_schedules": 20,
  "investments": [
    {
      "id": "IN-2508-0399484",
      "note": "MT-2507-2993370 - SAP 132",
      "status": "Invested",
      "amount": "RM 110.00",
      "note_reference": "MT-2507-2993370 - SAP 132",
      "note_type": "islamic",
      "tenor": "6 Months",
      "credit_risk_rating": "1R-3",
      "investment_amount": "RM 110.00",
      "profit_rate": "9.00%(equivalent to 18.00% p.a)",
      "total_profit": "RM 9.90",
      "total_gross_return": "RM 119.90",
      "investor_fee": "RM 1.10",
      "withholding_tax": "RM 0.00",
      "total_net_returns": "RM 118.80",
      "pledged_on": "01/08/2025",
      "disbursed_on": "04/08/2025",
      "payment_schedule": [
        {
          "payment_date": "13/10/2025",
          "repayment_status": "scheduled",
          "action": "...",
          "investor_fee": "RM 0.00",
          "total_returns": "RM 1.65",
          "principal_due": "RM 0.00",
          "profit_due": "RM 1.65",
          "total_paid": "RM 0.00",
          "withholding_tax": "RM 0.00",
          "total_settled": "RM 0.00"
        }
      ]
    }
  ]
}
```

## Features Explained

### 🌐 Dashboard Navigation
- Automatically opens the MicroLeap dashboard
- Focuses existing tab if already open
- Detects login status based on URL patterns

### 🔐 Login Detection
- Checks if current URL contains `/login`
- Prompts user to log in manually if needed
- Verifies login status on demand

### 📊 Smart Extraction
- Sets page size to maximum (1000) to get all investments
- Extracts investment list from table rows
- Fetches detailed data for each investment via API calls
- Handles errors gracefully and continues processing

### 📈 Progress Tracking
- Real-time progress updates during extraction
- Shows current investment being processed
- Displays percentage completion

### 💾 Data Export
- Structured JSON format with metadata
- Includes extraction timestamp
- Summary statistics (total investments, those with schedules)
- Individual investment details and payment schedules

## Troubleshooting

### Extension Not Loading
- Make sure Developer mode is enabled in `chrome://extensions/`
- Check that all files are present in the extension folder
- Reload the extension if needed

### Login Issues
- Make sure you're logged into MicroLeap in the same browser
- Try refreshing the dashboard tab and clicking "Verify Login"
- Clear cookies and log in again if needed

### Extraction Fails
- Check that you're properly logged in
- Ensure you have investments in your account
- Try refreshing the page and starting extraction again
- Check browser console for error messages

### No Data Downloaded
- Make sure extraction completed successfully (100% progress)
- Check browser's download settings
- Try clicking "Download Data" again

## Technical Details

### Architecture
- **Manifest V3** Chrome extension
- **Background Script** - Handles tab management and coordination
- **Content Script** - Performs data extraction on MicroLeap pages  
- **Popup** - User interface for controlling the extension

### Permissions Required
- `activeTab` - Access current tab
- `tabs` - Create and manage tabs
- `storage` - Store extraction results
- `scripting` - Inject content scripts
- `https://dashboard.microleapasia.com/*` - Access MicroLeap domain

### Data Flow
1. Popup → Background Script (user actions)
2. Background Script → Content Script (extraction commands)
3. Content Script → MicroLeap API (data fetching)
4. Content Script → Background Script (progress updates)
5. Background Script → Popup (status updates)
6. Popup → User (download JSON file)

## Privacy & Security

- **No Data Collection** - All data stays in your browser
- **Local Processing** - Extraction happens entirely on your device
- **Temporary Storage** - Data is only stored temporarily for download
- **Secure Communication** - Uses HTTPS for all MicroLeap communications

## Development

### File Structure
```
extension/
├── manifest.json       # Extension configuration
├── background.js       # Background service worker
├── content.js         # Content script for data extraction
├── popup.html         # Extension popup interface
├── popup.js           # Popup functionality
├── styles.css         # Popup styling
└── README.md          # This documentation
```

### Building
No build process required - the extension runs directly from source files.

### Testing
1. Load the extension in Chrome
2. Test on MicroLeap dashboard with test data
3. Verify JSON output structure
4. Check error handling with network issues

---

**Built for [MicroLeap Asia](https://dashboard.microleapasia.com/)**

*This extension is not officially affiliated with MicroLeap Asia. Use responsibly and in accordance with MicroLeap's terms of service.*
