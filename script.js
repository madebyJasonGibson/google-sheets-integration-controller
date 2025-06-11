// removed const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'; // Moved to top level if needed globally or pass as arg

const API_HISTORY_STORAGE_KEY = 'sheetMateApiHistory';
const SETTINGS_STORAGE_KEY = 'sheetMateSettings';
const MAX_HISTORY_ENTRIES = 20; // Limit the number of history entries

function getConfig() {
    return {
        sheetId: document.getElementById('sheetId').value,
        apiKey: document.getElementById('apiKey').value
    };
}

// Function to show response in the correct section
function showResponse(data, section = 'mainContent') {
    let responseElementId;
    // Determine the correct response element based on the section
    switch (section) {
        case 'api-section':
            responseElementId = 'api-response';
            break;
        case 'data-operations-section':
            responseElementId = 'data-response';
            break;
        case 'integrations-section':
            responseElementId = 'integrations-response'; // New response area for integrations
            break;
        case 'settings-section':
             // Settings section doesn't have a dedicated response area for API calls
             // We can log to console or show a specific message if needed
             console.log("Settings related response:", data);
             return; // Don't try to update a UI element that doesn't exist
        default:
            responseElementId = 'response'; // Default for mainContent
    }

    const responseElement = document.getElementById(responseElementId);
    if (responseElement) {
        try {
             // Use JSON.stringify with indentation for readability
             responseElement.textContent = JSON.stringify(data, null, 2);
        } catch (e) {
             // Handle cases where data might not be JSON serializable
             responseElement.textContent = String(data);
        }
    } else {
         console.error(`Response element with ID ${responseElementId} not found.`);
         // Fallback to console if UI element isn't ready
         console.log(`API Response (${section}):`, data);
    }
}

function showError(error, section = 'mainContent') {
    console.error("API Error:", error);
    const errorData = error.response ? error.response.data : { message: error.message };
    showResponse({ error: errorData }, section);
    logApiRequest(error.config?.url, error.config?.method, error.config?.data, null, errorData); // Log the error
}

// --- API History Management ---
function getApiHistory() {
    try {
        const history = localStorage.getItem(API_HISTORY_STORAGE_KEY);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error("Failed to load API history from local storage:", e);
        return [];
    }
}

function saveApiHistory(history) {
    try {
        localStorage.setItem(API_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.error("Failed to save API history to local storage:", e);
    }
}

function logApiRequest(url, method, data, response, error) {
    const history = getApiHistory();
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        url: url || 'N/A',
        method: method || 'N/A',
        requestData: data, // Log request payload
        responseData: response, // Log successful response data
        error: error // Log error details
    };
    history.unshift(entry); // Add to the beginning
    while (history.length > MAX_HISTORY_ENTRIES) {
        history.pop(); // Remove oldest entry if exceeding limit
    }
    saveApiHistory(history);
}

function showApiHistory() {
    const history = getApiHistory();
    const historyDisplay = document.getElementById('api-response'); // Use the API section response area
    if (!historyDisplay) {
        console.error("API history display element not found.");
        return;
    }

    if (history.length === 0) {
        historyDisplay.textContent = "No local API history recorded yet.";
        return;
    }

    // Format history for display
    const formattedHistory = history.map(entry => {
        let details = `Timestamp: ${entry.timestamp}\nMethod: ${entry.method}\nURL: ${entry.url}\n`;
        if (entry.requestData) {
            details += `Request Data: ${JSON.stringify(entry.requestData, null, 2)}\n`;
        }
        if (entry.responseData) {
             // Truncate large responses for history display
             const responseString = JSON.stringify(entry.responseData, null, 2);
             details += `Response Data: ${responseString.substring(0, 500)}${responseString.length > 500 ? '...' : ''}\n`;
        }
        if (entry.error) {
            details += `Error: ${JSON.stringify(entry.error, null, 2)}\n`;
        }
        return `--- API Call ---\n${details}`;
    }).join('\n\n'); // Separate entries with double newlines

    historyDisplay.textContent = formattedHistory;
    // Optional: Add a title above the history display
    // document.getElementById('api-section').querySelector('.space-y-4 h2').textContent = 'API Call History';
}

// --- API Call Wrappers with Logging ---
async function fetchFromSheets(url, method = 'GET', data = null) {
    const config = getConfig();
    if (!config.sheetId || !config.apiKey) {
       throw new Error("Sheet ID or API Key is missing.");
    }

    const fullUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/${url}&key=${config.apiKey}`;
    const requestConfig = {
        method: method,
        url: fullUrl,
        data: data
    };

    try {
        const response = await axios(requestConfig);
        logApiRequest(fullUrl, method, data, response.data, null); // Log success
        return response.data;
    } catch (error) {
         // Log error within showError
        throw error; // Re-throw to be caught by the caller for UI display
    }
}

async function getSheetData() {
    try {
        const data = await fetchFromSheets('values/Sheet1?'); // Parameters after '?'
        showResponse(data, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

async function appendData() {
    try {
        const dataInput = document.getElementById('appendDataInput').value;
        let newRow;
        try {
            newRow = JSON.parse(dataInput);
            if (!Array.isArray(newRow)) {
                throw new Error("Input must be a JSON array.");
            }
            // Sheets API expects an array of arrays for values when appending/updating ranges
            newRow = [newRow];
        } catch (e) {
             showError("Invalid JSON array format for append data.", 'data-operations-section');
             console.error("Parsing error:", e);
             return;
        }

        const response = await fetchFromSheets('values/Sheet1:append?valueInputOption=RAW', 'POST', {
            range: "Sheet1",
            majorDimension: "ROWS",
            values: newRow
        });
        showResponse(response, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

async function updateData() {
    try {
        const rangeInput = document.getElementById('updateRangeInput').value;
        const dataInput = document.getElementById('updateDataInput').value;

         if (!rangeInput) {
             showError("Range for update is missing.", 'data-operations-section');
             return;
         }

        let updatedValues;
        try {
            updatedValues = JSON.parse(dataInput);
             if (!Array.isArray(updatedValues) || (updatedValues.length > 0 && !Array.isArray(updatedValues[0]))) {
                 throw new Error("Input must be a JSON array of arrays.");
             }
        } catch (e) {
             showError("Invalid JSON array of arrays format for update data.", 'data-operations-section');
             console.error("Parsing error:", e);
             return;
        }

        const response = await fetchFromSheets(`values/${encodeURIComponent(rangeInput)}?valueInputOption=RAW`, 'PUT', {
            range: rangeInput,
            majorDimension: "ROWS",
            values: updatedValues
        });
        showResponse(response, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

async function testApiConnection() {
    try {
        const config = getConfig();
         if (!config.sheetId || !config.apiKey) {
            showError("Sheet ID or API Key is missing.", 'api-section');
            return;
        }
         // Fetching metadata is a lightweight way to test connection/auth
        const data = await fetchFromSheets('?fields=spreadsheetId,properties.title', 'GET');
        showResponse({ success: true, sheetTitle: data.properties.title, spreadsheetId: data.spreadsheetId }, 'api-section');
    } catch (error) {
        showError(error, 'api-section');
    }
}

function clearCache() {
    // This function clears the *local storage* for config and history
    try {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
        localStorage.removeItem(API_HISTORY_STORAGE_KEY);

        // Clear input fields that might have been loaded from storage
        document.getElementById('sheetId').value = '';
        document.getElementById('apiKey').value = '';

        // Reset settings UI elements to default (or unloaded state)
        resetSettingsUI();

        showResponse({ message: "Local settings and API history cleared." }, 'api-section');
        console.log("Local storage for settings and history cleared.");

    } catch (e) {
        console.error("Failed to clear local storage:", e);
        showError({ message: "Failed to clear local storage.", error: e.message }, 'api-section');
    }
}

// --- Settings Management ---
function saveSettings() {
    const settings = {
        darkMode: document.body.classList.contains('dark-mode'),
        saveApiKey: document.querySelector('input[name="save-api-key"]').checked,
        saveSheetId: document.querySelector('input[name="save-sheet-id"]').checked,
        enableCaching: document.querySelector('input[name="data-cache"]').checked, // Placeholder state saved
        autoRefresh: document.querySelector('input[name="autoload"]').checked, // Placeholder state saved
        compressResponse: document.querySelector('input[name="compress-response"]').checked, // Placeholder state saved
        enableNotifications: document.querySelector('input[name="notification"]').checked, // Placeholder state saved
        notifyOnErrors: document.querySelector('input[name="notification-errors"]').checked // Placeholder state saved
    };

    // Only save sheetId and apiKey if the respective boxes are checked
    if (settings.saveSheetId) {
        settings.sheetId = document.getElementById('sheetId').value;
    } else {
        delete settings.sheetId; // Ensure it's not saved if box is unchecked
    }
     if (settings.saveApiKey) {
        settings.apiKey = document.getElementById('apiKey').value;
    } else {
        delete settings.apiKey; // Ensure it's not saved if box is unchecked
    }

    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        console.log("Settings saved to local storage.");
    } catch (e) {
        console.error("Failed to save settings to local storage:", e);
    }
}

function loadSettings() {
    try {
        const settingsJson = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!settingsJson) {
             console.log("No settings found in local storage. Applying defaults.");
             // Apply default theme if no settings found
             toggleDarkMode('light');
             resetSettingsUI(); // Apply default unchecked state for other settings
             return;
        }

        const settings = JSON.parse(settingsJson);
        console.log("Settings loaded from local storage:", settings);

        // Apply loaded settings to the UI
        // Theme
        toggleDarkMode(settings.darkMode ? 'dark' : 'light');

        // Save/Load inputs (Sheet ID, API Key)
        // Use optional chaining (?.) for safety in case properties are missing from old storage
        document.querySelector('input[name="save-sheet-id"]').checked = settings.saveSheetId ?? false;
        document.querySelector('input[name="save-api-key"]').checked = settings.saveApiKey ?? false;

        // Load Sheet ID and API Key if the save setting was true AND value exists
        if (settings.saveSheetId && settings.sheetId) {
            document.getElementById('sheetId').value = settings.sheetId;
        } else {
             document.getElementById('sheetId').value = ''; // Clear if not saved or value missing
        }
        if (settings.saveApiKey && settings.apiKey) {
            document.getElementById('apiKey').value = settings.apiKey;
        } else {
             document.getElementById('apiKey').value = ''; // Clear if not saved or value missing
        }

        // Apply other placeholder settings states
        document.querySelector('input[name="data-cache"]').checked = settings.enableCaching ?? false;
        document.querySelector('input[name="autoload"]').checked = settings.autoRefresh ?? false;
        document.querySelector('input[name="compress-response"]').checked = settings.compressResponse ?? false;
        document.querySelector('input[name="notification"]').checked = settings.enableNotifications ?? false;
        document.querySelector('input[name="notification-errors"]').checked = settings.notifyOnErrors ?? false;

    } catch (e) {
        console.error("Failed to load settings from local storage:", e);
        // Ensure a default state is applied even if loading fails
         toggleDarkMode('light');
         resetSettingsUI(); // Reset UI to default unchecked states
    }
}

function resetSettingsUI() {
     // Set checkboxes to unchecked, radio to light theme
     document.querySelectorAll('#settings-section input[type="checkbox"]').forEach(checkbox => {
         checkbox.checked = false;
     });

     const radios = document.querySelectorAll('input[type="radio"][name="theme-radio"]');
      radios.forEach(radio => {
          radio.checked = (radio.value === 'light'); // Check light mode radio
      });
      // Manually update toggle button icon if it doesn't sync automatically
      // toggleDarkMode('light'); // Calling this here might cause a save loop if called during load
}

// --- UI Functions ---
// Function to toggle sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    // Optional: adjust content area margin/width if needed
}

// Function to show specific content section
function showSection(sectionId, sourceElement) {
    // Hide all content sections
    const sections = ['mainContent', 'api-section', 'data-operations-section', 'integrations-section', 'settings-section'];
    sections.forEach(id => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = 'none';
    });

    // Show selected section
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
        // If navigating to specific sections, update their display areas
        if (sectionId === 'api-section') {
             document.getElementById('api-response').textContent = 'Select an API tool above or view history.';
        } else if (sectionId === 'data-operations-section') {
             document.getElementById('data-response').textContent = 'Select a data operation above.';
        } else if (sectionId === 'mainContent') {
             document.getElementById('response').textContent = 'Configure Sheet ID and API Key above.';
        } else if (sectionId === 'integrations-section') {
             document.getElementById('integrations-response').textContent = 'Integration specific responses will appear here (Placeholders).';
        }
        // Settings section doesn't need initial text in a response area
    }

    // Update active class on sidebar links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active', 'text-fuchsia-600', 'font-medium');
        link.classList.add('hover:bg-fuchsia-50'); // Add hover back
    });

     if (sourceElement) {
        sourceElement.classList.add('active', 'text-fuchsia-600', 'font-medium');
         sourceElement.classList.remove('hover:bg-fuchsia-50'); // Remove hover on active
    }
}

function toggleDarkMode(mode) {
    const body = document.body;
    const iconButton = document.getElementById('theme-icon2'); // Button icon
     const iconSettings = document.getElementById('theme-icon'); // Settings icon

    let isDarkMode;
    if (mode === 'dark') {
        body.classList.add('dark-mode');
        isDarkMode = true;
    } else if (mode === 'light') {
        body.classList.remove('dark-mode');
        isDarkMode = false;
    } else {
        // If mode is not specified, toggle based on current state
        isDarkMode = !body.classList.contains('dark-mode');
        body.classList.toggle('dark-mode');
    }

    // Update icons based on the final state
    if (iconButton) iconButton.textContent = isDarkMode ? 'light_mode' : 'dark_mode';
     if (iconSettings) iconSettings.textContent = isDarkMode ? 'light_mode' : 'dark_mode';

    // Update radio buttons state to match the mode
    const radios = document.querySelectorAll('input[type="radio"][name="theme-radio"]');
     radios.forEach(radio => {
         radio.checked = (radio.value === 'dark' && isDarkMode) || (radio.value === 'light' && !isDarkMode);
     });

     // Save theme preference immediately
     saveSettings();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
     // Load settings first to apply theme and input values
     loadSettings();

    // Set default section to mainContent (Dashboard) if no specific section was stored/loaded
     // Or simply show the default section after loading inputs
     showSection('mainContent', document.querySelector('.nav-link'));

    // Add event listeners for settings controls to save state
    // Use a common parent element like #settings-section for efficiency
    const settingsSection = document.getElementById('settings-section');
    if (settingsSection) {
        settingsSection.addEventListener('change', (event) => {
            // Save settings when any input within the settings section changes state
            // This covers checkboxes and radio buttons primarily
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' || event.target.tagName === 'TEXTAREA') {
                saveSettings();
            }
        });
         // Also listen for input events on text fields within settings if any are added later
         settingsSection.addEventListener('input', (event) => {
             if (event.target.tagName === 'INPUT' && event.target.type === 'text') {
                 saveSettings();
             }
         });
    }


     // Listen for changes on sheetId and apiKey inputs specifically
     // These are outside the settings section but affect settings storage
     document.getElementById('sheetId')?.addEventListener('input', saveSettings);
     document.getElementById('apiKey')?.addEventListener('input', saveSettings);

     // Listen for changes on the theme radio buttons directly if needed,
     // though the change listener on settingsSection might cover it.
     // Let's add a specific listener for the radios to ensure theme update logic runs
     const themeRadios = document.querySelectorAll('input[type="radio"][name="theme-radio"]');
     themeRadios.forEach(radio => {
         radio.addEventListener('change', (event) => {
             if (event.target.checked) {
                 toggleDarkMode(event.target.value);
             }
         });
     });


     // Expose functions globally so they can be called from inline onclick attributes
     // This is necessary because the script is not a module with an importmap.
     window.toggleSidebar = toggleSidebar;
     window.showSection = showSection;
     window.toggleDarkMode = toggleDarkMode;
     window.getSheetData = getSheetData;
     window.appendData = appendData;
     window.updateData = updateData;
     window.testApiConnection = testApiConnection;
     window.clearCache = clearCache; // Clear local storage button
     window.showApiHistory = showApiHistory; // Show local history button
});

// Note: Placeholder functions like 'enable local caching', 'auto-refresh', etc.,
// are now simply saving their state to localStorage via the generic settings listener.
// Their actual *effect* on the application logic (like caching API responses,
// periodically fetching data, or altering request headers) is not implemented
// in this client-side code, as that would require more complex state management
// or a backend component. The saved state serves as a UI-only representation
// of these "settings". Similarly, the Integrations section is a UI placeholder.
