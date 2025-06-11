// removed const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'; // Moved to top level if needed globally or pass as arg

function getConfig() {
    return {
        sheetId: document.getElementById('sheetId').value,
        apiKey: document.getElementById('apiKey').value
    };
}

// Function to show response in the correct section
function showResponse(data, section = 'mainContent') {
    let responseElementId;
    if (section === 'api-section') {
        responseElementId = 'api-response';
    } else if (section === 'data-operations-section') {
         responseElementId = 'data-response';
    } else {
         responseElementId = 'response'; // Default for mainContent
    }
    const responseElement = document.getElementById(responseElementId);
    if (responseElement) {
         responseElement.textContent = JSON.stringify(data, null, 2);
    } else {
         console.error(`Response element with ID ${responseElementId} not found.`);
         // Fallback to console if UI element isn't ready
         console.log("API Response:", data);
    }
}

function showError(error, section = 'mainContent') {
    console.error(error);
    const errorData = error.response ? error.response.data : error.message;
    showResponse({ error: errorData }, section);
}

async function getSheetData() {
    try {
        const config = getConfig();
         if (!config.sheetId || !config.apiKey) {
            showError("Sheet ID or API Key is missing.", 'data-operations-section');
            return;
        }
        // Using axios directly as it's loaded via CDN
        const response = await axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/Sheet1?key=${config.apiKey}`
        );
        showResponse(response.data, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

async function appendData() {
    try {
        const config = getConfig();
         if (!config.sheetId || !config.apiKey) {
            showError("Sheet ID or API Key is missing.", 'data-operations-section');
            return;
        }
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

        // Using axios directly as it's loaded via CDN
        const response = await axios.post(
            `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/Sheet1:append?valueInputOption=RAW&key=${config.apiKey}`,
            {
                range: "Sheet1", // Can specify a starting range, append finds the next available row
                majorDimension: "ROWS",
                values: newRow // Expects array of arrays
            }
        );
        showResponse(response.data, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

async function updateData() {
    try {
        const config = getConfig();
         if (!config.sheetId || !config.apiKey) {
            showError("Sheet ID or API Key is missing.", 'data-operations-section');
            return;
        }
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

        // Using axios directly as it's loaded via CDN
        const response = await axios.put(
            `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${encodeURIComponent(rangeInput)}?valueInputOption=RAW&key=${config.apiKey}`,
            {
                range: rangeInput,
                majorDimension: "ROWS",
                values: updatedValues // Expects array of arrays
            }
        );
        showResponse(response.data, 'data-operations-section');
    } catch (error) {
        showError(error, 'data-operations-section');
    }
}

// Function to toggle sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
}

// Function to show specific content section
function showSection(sectionId, sourceElement) {
    // Hide all content sections
    const sections = ['mainContent', 'api-section', 'data-operations-section', 'settings-section'];
    sections.forEach(id => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = 'none';
    });
    
    // Show selected section
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
    }

    // Update active class on sidebar links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active', 'text-fuchsia-600', 'font-medium'));
     navLinks.forEach(link => link.classList.add('hover:bg-fuchsia-50')); // Add hover back

     if (sourceElement) {
        sourceElement.classList.add('active', 'text-fuchsia-600', 'font-medium');
         sourceElement.classList.remove('hover:bg-fuchsia-50'); // Remove hover on active
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
        // Using axios directly as it's loaded via CDN
        const response = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}?key=${config.apiKey}&fields=spreadsheetId,properties.title`);
        showResponse({ success: true, sheetTitle: response.data.properties.title }, 'api-section');
    } catch (error) {
        showError(error, 'api-section');
    }
}

function clearCache() {
    // Clear local config inputs - does not clear actual cache if any were implemented
    document.getElementById('sheetId').value = '';
    document.getElementById('apiKey').value = '';
    showResponse({ message: "Local input fields cleared. Note: This application currently does not implement advanced caching mechanisms." }, 'api-section');
}

function showApiHistory() {
    // This is a placeholder function
    showResponse({ message: "Audit log history feature not implemented yet." }, 'api-section');
}

function toggleDarkMode(mode) {
    const body = document.body;
    const iconButton = document.getElementById('theme-icon2'); // Button icon
     const iconSettings = document.getElementById('theme-icon'); // Settings icon

    if (mode === 'dark') {
        body.classList.add('dark-mode');
    } else if (mode === 'light') {
        body.classList.remove('dark-mode');
    } else {
        // If mode is not specified, toggle based on current state
        body.classList.toggle('dark-mode');
    }

    // Update icons based on the final state
    const isDarkMode = body.classList.contains('dark-mode');
    if (iconButton) iconButton.textContent = isDarkMode ? 'light_mode' : 'dark_mode';
     if (iconSettings) iconSettings.textContent = isDarkMode ? 'light_mode' : 'dark_mode';

    // Update radio buttons state to match the mode
    const radios = document.querySelectorAll('input[type="radio"][name="theme-radio"]');
     radios.forEach(radio => {
         radio.checked = (radio.value === 'dark' && isDarkMode) || (radio.value === 'light' && !isDarkMode);
     });
}

document.addEventListener('DOMContentLoaded', () => {
    // Set default section to mainContent (Dashboard)
     showSection('mainContent', document.querySelector('.nav-link'));

    // Add event listeners for theme radio buttons
    const radios = document.querySelectorAll('input[type="radio"][name="theme-radio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
               toggleDarkMode(e.target.value);
            }
        });
    });

     // Initialize theme based on default radio button state (light mode checked)
     // Or check local storage if persistence was implemented
     toggleDarkMode('light'); // Start in light mode by default, update icons/radios

     // Expose functions globally so they can be called from inline onclick attributes
     window.toggleSidebar = toggleSidebar;
     window.showSection = showSection;
     window.toggleDarkMode = toggleDarkMode;
     window.getSheetData = getSheetData;
     window.appendData = appendData;
     window.updateData = updateData;
     window.testApiConnection = testApiConnection;
     window.clearCache = clearCache;
     window.showApiHistory = showApiHistory;
});
