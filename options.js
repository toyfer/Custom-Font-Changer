document.addEventListener('DOMContentLoaded', () => {
    const fontUrlInput = document.getElementById('fontUrl');
    const saveFontUrlButton = document.getElementById('saveFontUrl');
    const fontStatusDiv = document.getElementById('fontStatus');
    const currentFontUrlDisplay = document.getElementById('currentFontUrlDisplay');

    const excludedUrlInput = document.getElementById('excludedUrl');
    const addExcludedUrlButton = document.getElementById('addExcludedUrl');
    const exclusionStatusDiv = document.getElementById('exclusionStatus');
    const excludedUrlsListUl = document.getElementById('excludedUrlsList');

    // --- Font URL Management ---

    // Load and display current font URL
    chrome.storage.sync.get('selectedFontUrl', (data) => {
        if (data.selectedFontUrl) {
            fontUrlInput.value = data.selectedFontUrl;
            currentFontUrlDisplay.textContent = data.selectedFontUrl;
        }
    });

    saveFontUrlButton.addEventListener('click', () => {
        const url = fontUrlInput.value.trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            chrome.storage.sync.set({ selectedFontUrl: url }, () => {
                fontStatusDiv.textContent = 'Font URL saved successfully!';
                fontStatusDiv.className = 'message success';
                fontStatusDiv.style.display = 'block';
                currentFontUrlDisplay.textContent = url;
                // Optionally, send a message to service worker to update cache
                // chrome.runtime.sendMessage({ type: 'UPDATE_FONT_CACHE', url: url });
                setTimeout(() => { fontStatusDiv.style.display = 'none'; }, 3000);
            });
        } else {
            fontStatusDiv.textContent = 'Please enter a valid URL (starting with http:// or https://).';
            fontStatusDiv.className = 'message error';
            fontStatusDiv.style.display = 'block';
            setTimeout(() => { fontStatusDiv.style.display = 'none'; }, 3000);
        }
    });

    // --- Excluded URLs Management ---
    let excludedUrls = [];

    function renderExcludedUrls() {
        excludedUrlsListUl.innerHTML = ''; // Clear current list
        excludedUrls.forEach((urlPattern, index) => {
            const li = document.createElement('li');
            li.textContent = urlPattern;
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.style.marginLeft = '10px';
            removeButton.addEventListener('click', () => {
                excludedUrls.splice(index, 1);
                chrome.storage.sync.set({ excludedUrls: excludedUrls }, () => {
                    renderExcludedUrls();
                    exclusionStatusDiv.textContent = `Removed '${urlPattern}'.`;
                    exclusionStatusDiv.className = 'message success';
                    exclusionStatusDiv.style.display = 'block';
                    setTimeout(() => { exclusionStatusDiv.style.display = 'none'; }, 3000);
                });
            });
            li.appendChild(removeButton);
            excludedUrlsListUl.appendChild(li);
        });
    }

    // Load and display excluded URLs
    chrome.storage.sync.get('excludedUrls', (data) => {
        if (data.excludedUrls && Array.isArray(data.excludedUrls)) {
            excludedUrls = data.excludedUrls;
            renderExcludedUrls();
        }
    });

    addExcludedUrlButton.addEventListener('click', () => {
        const newPattern = excludedUrlInput.value.trim();
        if (newPattern && !excludedUrls.includes(newPattern)) {
            excludedUrls.push(newPattern);
            chrome.storage.sync.set({ excludedUrls: excludedUrls }, () => {
                renderExcludedUrls();
                excludedUrlInput.value = ''; // Clear input
                exclusionStatusDiv.textContent = `Added '${newPattern}'.`;
                exclusionStatusDiv.className = 'message success';
                exclusionStatusDiv.style.display = 'block';
                setTimeout(() => { exclusionStatusDiv.style.display = 'none'; }, 3000);
            });
        } else if (excludedUrls.includes(newPattern)) {
            exclusionStatusDiv.textContent = `'${newPattern}' is already in the list.`;
            exclusionStatusDiv.className = 'message error';
            exclusionStatusDiv.style.display = 'block';
            setTimeout(() => { exclusionStatusDiv.style.display = 'none'; }, 3000);
        } else {
            exclusionStatusDiv.textContent = 'Please enter a URL pattern.';
            exclusionStatusDiv.className = 'message error';
            exclusionStatusDiv.style.display = 'block';
            setTimeout(() => { exclusionStatusDiv.style.display = 'none'; }, 3000);
        }
    });
});
