// content.js
(function() {
    // console.log("Custom Font Changer: Content script initially loaded.");

    // Check if the script has already run or if essential elements are missing
    if (document.getElementById('custom-font-changer-style')) {
        // console.log("Custom Font Changer: Style already applied or script re-injection detected.");
        return;
    }
    if (!document.head) {
        // console.warn("Custom Font Changer: document.head not available yet. Script might be running too early.");
        // Retry once the DOM is more complete, or rely on manifest's run_at.
        // For simplicity with document_idle, we expect head to be available.
        return;
    }

    chrome.storage.sync.get(['selectedFontUrl', 'excludedUrls'], (data) => {
        const { selectedFontUrl, excludedUrls } = data;
        const currentUrl = window.location.href;

        // console.log("Custom Font Changer: Retrieved settings. Font URL:", selectedFontUrl, "Exclusions:", excludedUrls);

        if (!selectedFontUrl) {
            // console.log("Custom Font Changer: No font URL selected. Exiting.");
            return;
        }

        // Check if current URL is excluded
        if (excludedUrls && Array.isArray(excludedUrls)) {
            for (const pattern of excludedUrls) {
                if (pattern && typeof pattern === 'string' && pattern.trim() !== "") { // Ensure pattern is valid
                    try {
                        // Basic exclusion: if the pattern (treated as a simple string) is part of the URL
                        // For more complex patterns (e.g. host matching, wildcards), a robust library or regex might be needed.
                        // Example: *.example.com -> needs regex new RegExp('^https?://([^\\.]+\\.)*?' + pattern.substring(2).replace(/\./g, '\\.') + '(/.*)?$')
                        // For now, simple includes:
                        if (currentUrl.includes(pattern.trim())) {
                            console.log(`Custom Font Changer: URL ${currentUrl} is excluded by pattern: '${pattern}'. Font not applied.`);
                            return;
                        }
                    } catch (e) {
                        console.warn(`Custom Font Changer: Error processing exclusion pattern '${pattern}'.`, e);
                    }
                }
            }
        }

        // Apply the font
        try {
            const styleId = 'custom-font-changer-style';
            // It's good practice to remove an existing style element if we're re-applying,
            // though with run_at: document_idle, this content script typically runs once per frame.
            const existingStyleElement = document.getElementById(styleId);
            if (existingStyleElement) {
                existingStyleElement.remove();
            }

            const styleElement = document.createElement('style');
            styleElement.id = styleId;
            const fontName = 'UserSelectedWebFont'; // Consistent font family name

            styleElement.textContent = `
                @font-face {
                    font-family: '${fontName}';
                    src: url('${selectedFontUrl}');
                    /* Common font descriptors, consider adding more if known or configurable */
                    font-weight: normal; 
                    font-style: normal;
                    font-display: swap;
                    /* Consider adding font-weight and font-style if you want to be more specific
                       or if the font files themselves don't declare them adequately.
                       For a generic solution, 'normal' is a safe bet, or omit them. */
                    font-weight: normal;
                    font-style: normal;
                }

                html *, /* Apply to html element and all its descendants */
                body,   /* Apply to body specifically if html * doesn't catch it */
                body *  /* Apply to all descendants of body */
                :not(i):not(span[class*="icon"]):not(span[class*="Icon"]):not(svg):not(path):not([class*="fa-"]):not([class*="fa"]):not([class*="fas"]):not([class*="far"]):not([class*="fab"]):not([class*="glyphicon"]):not([class*="material-symbols"]):not([class*="material-icons"]):not([class*="icon-"]):not(code):not(kbd):not(samp):not(pre) {
                    font-family: '${fontName}', sans-serif !important;
                }
            `;
            
            if (document.head) {
                 document.head.appendChild(styleElement);
                 console.log(`Custom Font Changer: Applied font from URL '${selectedFontUrl}' as '${fontName}' to ${currentUrl}`);
            } else {
                // Fallback if head is somehow still not ready, though unlikely with document_idle
                // document.addEventListener('DOMContentLoaded', () => document.head.appendChild(styleElement));
                console.warn("Custom Font Changer: document.head not available for appending style. Font not applied.");
            }

        } catch (error) {
            console.error("Custom Font Changer: Error applying font:", error);
        }
    });
})();
