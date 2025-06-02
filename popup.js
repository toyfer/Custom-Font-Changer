// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const currentSiteDisplay = document.getElementById('currentSiteDisplay');
    const toggleExclusionButton = document.getElementById('toggleExclusionButton');
    const statusMessage = document.getElementById('statusMessage');

    let currentTab = null;
    let currentHostname = '';
    let excludedUrls = [];

    // Function to update button text and state
    function updateButtonState() {
        if (!currentHostname) { // Should not happen if tab is valid
            toggleExclusionButton.textContent = "Error: No site context";
            toggleExclusionButton.disabled = true;
            return;
        }
        if (excludedUrls.includes(currentHostname)) {
            toggleExclusionButton.textContent = `Include site: ${currentHostname}`;
            toggleExclusionButton.dataset.action = 'include';
        } else {
            toggleExclusionButton.textContent = `Exclude site: ${currentHostname}`;
            toggleExclusionButton.dataset.action = 'exclude';
        }
        toggleExclusionButton.disabled = false;
    }

    // Load current tab info and exclusion status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error("Popup: Error querying tabs:", chrome.runtime.lastError.message);
            currentSiteDisplay.textContent = "Error loading tab info.";
            toggleExclusionButton.textContent = "Error";
            toggleExclusionButton.disabled = true;
            statusMessage.textContent = "Could not get current tab details.";
            return;
        }

        if (tabs && tabs.length > 0) {
            currentTab = tabs[0];
            if (!currentTab.url) {
                currentSiteDisplay.textContent = "N/A (No URL)";
                toggleExclusionButton.textContent = "Cannot manage this page";
                toggleExclusionButton.disabled = true;
                statusMessage.textContent = "This page does not have a standard URL.";
                return;
            }

            try {
                const url = new URL(currentTab.url);
                // Use hostname for exclusion by default.
                currentHostname = url.hostname;

                if (!currentHostname) { // e.g. for file:/// URLs or other schemes
                     currentSiteDisplay.textContent = "N/A (Local file or special page)";
                     toggleExclusionButton.textContent = "Cannot modify exclusions";
                     toggleExclusionButton.disabled = true;
                     statusMessage.textContent = "Exclusions are typically for http/https URLs.";
                     return;
                }
                currentSiteDisplay.textContent = currentHostname;

                chrome.storage.sync.get('excludedUrls', (data) => {
                    if (chrome.runtime.lastError) {
                        console.error("Popup: Error getting excludedUrls:", chrome.runtime.lastError.message);
                        statusMessage.textContent = "Error loading exclusion settings.";
                        toggleExclusionButton.disabled = true;
                        return;
                    }
                    if (data.excludedUrls && Array.isArray(data.excludedUrls)) {
                        excludedUrls = data.excludedUrls;
                    }
                    updateButtonState();
                });
            } catch (e) {
                // Handle invalid URLs (e.g., chrome:// pages which throw error on new URL())
                currentSiteDisplay.textContent = "N/A (Special page)";
                toggleExclusionButton.textContent = "Cannot modify exclusions";
                toggleExclusionButton.disabled = true;
                statusMessage.textContent = "Exclusions cannot be managed for this type of page.";
                 console.warn("Popup: Error parsing URL:", currentTab.url, e);
            }
        } else {
            currentSiteDisplay.textContent = "Error: No active tab found.";
            toggleExclusionButton.textContent = "Error";
            toggleExclusionButton.disabled = true;
            statusMessage.textContent = "Could not identify the active tab.";
        }
    });

    // Handle button click
    toggleExclusionButton.addEventListener('click', () => {
        if (!currentHostname || toggleExclusionButton.disabled) return;

        toggleExclusionButton.disabled = true; // Prevent double-clicks
        const action = toggleExclusionButton.dataset.action;
        let newExcludedUrls = [...excludedUrls]; // Create a new array for modification

        if (action === 'exclude') {
            if (!newExcludedUrls.includes(currentHostname)) {
                newExcludedUrls.push(currentHostname);
            }
        } else if (action === 'include') {
            newExcludedUrls = newExcludedUrls.filter(pattern => pattern !== currentHostname);
        }

        chrome.storage.sync.set({ excludedUrls: newExcludedUrls }, () => {
            if (chrome.runtime.lastError) {
                console.error("Popup: Error setting excludedUrls:", chrome.runtime.lastError.message);
                statusMessage.textContent = "Error saving exclusion settings.";
                // Re-enable button with old state on error
                updateButtonState(); // This will use the old 'excludedUrls'
                toggleExclusionButton.disabled = false;
                return;
            }

            excludedUrls = newExcludedUrls; // Update local state only on successful save
            updateButtonState();
            statusMessage.textContent = `Site ${action === 'exclude' ? 'excluded' : 'included'}. Reloading page...`;
            
            if (currentTab && currentTab.id) {
                chrome.tabs.reload(currentTab.id, {}, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("Popup: Error reloading tab:", chrome.runtime.lastError.message);
                        statusMessage.textContent += " Please reload manually.";
                         setTimeout(() => { statusMessage.textContent = ''; window.close(); }, 3500);
                    } else {
                        setTimeout(() => { statusMessage.textContent = ''; window.close(); }, 2500); // Close popup after action
                    }
                });
            } else {
                 setTimeout(() => { statusMessage.textContent = ''; window.close(); }, 2500);
            }
        });
    });
});
