// service-worker.js
const CACHE_NAME = 'user-font-cache-v2';
console.log("SW: CACHE_NAME set to:", CACHE_NAME);

let currentFontResource = null; // Can be a string (URL) or an object { cssUrl, fontAssetUrls }

// Helper to clear old font resources from cache
async function clearOldFontResources(cache) {
    console.log("SW: clearOldFontResources called. Current resource:", JSON.stringify(currentFontResource));
    if (!currentFontResource) {
        console.log("SW: No currentFontResource to clear.");
        return;
    }

    try {
        if (typeof currentFontResource === 'string') {
            console.log("SW: Deleting from cache (direct font):", currentFontResource);
            await cache.delete(currentFontResource);
        } else if (typeof currentFontResource === 'object' && currentFontResource.cssUrl) {
            console.log("SW: Deleting from cache (CSS):", currentFontResource.cssUrl);
            await cache.delete(currentFontResource.cssUrl);
            if (currentFontResource.fontAssetUrls && currentFontResource.fontAssetUrls.length > 0) {
                for (const assetUrl of currentFontResource.fontAssetUrls) {
                    console.log("SW: Deleting from cache (asset):", assetUrl);
                    await cache.delete(assetUrl);
                }
            }
        }
    } catch (error) {
        console.error('SW: Error deleting old font resource from cache:', error.message, error.stack);
    }
    currentFontResource = null; // Reset after clearing
    console.log("SW: Finished deleting old resources. currentFontResource reset to null.");
}

// Fetches and caches a single resource (font file or CSS file)
async function fetchAndCacheResource(url, cache) {
    console.log("SW: fetchAndCacheResource called for URL:", url);
    try {
        console.log("SW: Fetching resource:", url);
        const response = await fetch(url, { headers: { 'Accept': '*/*' } }); // Be liberal with accept headers
        console.log("SW: Resource fetched. Status:", response.status, "URL:", url);
        if (response.ok) {
            console.log("SW: Caching resource:", url);
            await cache.put(url, response.clone());
            console.log("SW: Resource cached successfully:", url);
            return response; // Return the response for further processing if needed (e.g., for CSS text)
        } else {
            console.error('SW: Failed to fetch resource. Status:', response.status, response.statusText, 'URL:', url);
        }
    } catch (error) {
        console.error("SW: Error in fetchAndCacheResource for URL:", url, error.message, error.stack);
        // Not re-throwing here as the caller cacheFont needs to decide how to handle partial failures
    }
    return null; // Return null on failure
}

// Regex to extract URLs from @font-face src properties
const FONT_URL_REGEX = /url\((['"]?)([^'"\)]+)\1\)/g;

// Main function to cache font (either direct URL or CSS with assets)
async function cacheFont(url) {
    console.log("SW: cacheFont called with URL:", url);
    if (!url || typeof url !== 'string' || (!url.startsWith('http:') && !url.startsWith('https://'))) {
        console.warn('SW: Invalid or empty URL provided to cacheFont:', url);
        await clearAndResetCurrentFontResource();
        return;
    }

    console.log("SW: Opening cache:", CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    console.log("SW: Cache opened successfully.");

    console.log("SW: Calling clearOldFontResources.");
    await clearOldFontResources(cache);

    const isCss = url.includes('css') || url.includes('googleapis.com/css');

    if (isCss) {
        console.log("SW: Detected as CSS URL:", url);
        console.log("SW: Fetching CSS file:", url);
        const cssResponse = await fetchAndCacheResource(url, cache); // fetchAndCacheResource already logs caching
        if (cssResponse) {
            // Log for successful fetch is inside fetchAndCacheResource
            // Log for caching CSS is inside fetchAndCacheResource
            try {
                const cssText = await cssResponse.text();
                console.log("SW: CSS text obtained. Length:", cssText.length);
                
                const extractedFontUrls = new Set();
                let match;
                console.log("SW: Parsing CSS for font URLs...");
                while ((match = FONT_URL_REGEX.exec(cssText)) !== null) {
                    if (match[2] && !match[2].startsWith('data:')) {
                         try {
                            const resolvedAssetUrl = new URL(match[2], url).href;
                            console.log("SW: Extracted font asset URL from CSS:", match[2], "(resolved: ", resolvedAssetUrl, ")");
                            extractedFontUrls.add(resolvedAssetUrl);
                         } catch (e) {
                            console.warn("SW: Could not parse or resolve URL from CSS:", match[2], "Base:", url, e.message);
                         }
                    }
                }

                const fontAssetUrls = Array.from(extractedFontUrls);
                if (fontAssetUrls.length > 0) {
                    const assetCachePromises = fontAssetUrls.map(assetUrl => {
                        console.log("SW: Calling fetchAndCacheResource for asset:", assetUrl);
                        return fetchAndCacheResource(assetUrl, cache);
                    });
                    await Promise.all(assetCachePromises);
                }
                currentFontResource = { cssUrl: url, fontAssetUrls: fontAssetUrls };
                console.log("SW: Finished processing CSS and its assets. currentFontResource set to:", JSON.stringify(currentFontResource));
            } catch (error) {
                console.error("SW: Error in cacheFont (CSS processing) for URL:", url, error.message, error.stack);
                await clearAndResetCurrentFontResource(); // Attempt to clean up partially cached state
            }
        } else {
            console.error('SW: Failed to fetch/cache the main CSS file in cacheFont. Aborting font setup for:', url);
            currentFontResource = null; 
        }
    } else {
        console.log("SW: Detected as direct font URL:", url);
        console.log("SW: Calling fetchAndCacheResource for direct font:", url);
        const fontResponse = await fetchAndCacheResource(url, cache);
        if (fontResponse) {
            currentFontResource = url;
            console.log("SW: Finished processing direct font. currentFontResource set to:", currentFontResource);
        } else {
            console.error('SW: Failed to fetch/cache direct font file in cacheFont. Aborting font setup for:', url);
            currentFontResource = null;
        }
    }
}

async function clearAndResetCurrentFontResource() {
    console.log("SW: clearAndResetCurrentFontResource called.");
    const cache = await caches.open(CACHE_NAME);
    await clearOldFontResources(cache); 
    console.log('SW: All font resources cleared and currentFontResource reset by clearAndResetCurrentFontResource.');
}

async function initializeFontCache() {
    console.log("SW: Initializing font cache...");
    try {
        const data = await chrome.storage.sync.get('selectedFontUrl');
        console.log("SW: Retrieved selectedFontUrl from storage:", data.selectedFontUrl);
        if (data.selectedFontUrl) {
            console.log("SW: Calling cacheFont for initial load with URL:", data.selectedFontUrl);
            await cacheFont(data.selectedFontUrl);
        } else {
            console.log("SW: No selectedFontUrl in storage during init.");
            console.log("SW: Calling clearAndResetCurrentFontResource during init because no URL in storage.");
            await clearAndResetCurrentFontResource();
        }
    } catch (error) {
        console.error('SW: Error getting selectedFontUrl from storage during initialization:', error.message, error.stack);
    }
}

self.addEventListener('install', (event) => {
    console.log("SW: Install event triggered.");
    event.waitUntil(
        initializeFontCache().then(() => {
            console.log("SW: initializeFontCache completed in install event.");
            console.log("SW: Calling self.skipWaiting().");
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log("SW: Activate event triggered.");
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("SW: Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('SW: Old caches deleted.');
            console.log("SW: Calling clients.claim().");
            return clients.claim();
        })
    );
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    console.log("SW: chrome.storage.onChanged triggered for namespace:", namespace);
    console.log("SW: Storage changes data:", JSON.stringify(changes));

    if (namespace === 'sync' && changes.selectedFontUrl) {
        const newUrl = changes.selectedFontUrl.newValue;
        const oldUrl = changes.selectedFontUrl.oldValue; // For logging clarity

        // Determine current effective URL for logging *before* any async operations modify currentFontResource
        let currentEffectiveUrlLog = 'undefined';
        if (typeof currentFontResource === 'string') {
            currentEffectiveUrlLog = currentFontResource;
        } else if (currentFontResource && typeof currentFontResource === 'object' && currentFontResource.cssUrl) {
            currentEffectiveUrlLog = currentFontResource.cssUrl;
        }
        console.log("SW: selectedFontUrl changed. New:", newUrl, "Old (from storage event):", oldUrl, "Current effective URL (before this change is processed):", currentEffectiveUrlLog);

        // Determine the effective URL that was active *before* this change event began processing
        // This is crucial because cacheFont/clearAndReset will modify currentFontResource
        let effectiveOldUrlForComparison = null;
        if (typeof currentFontResource === 'string') {
            effectiveOldUrlForComparison = currentFontResource;
        } else if (currentFontResource && typeof currentFontResource === 'object' && currentFontResource.cssUrl) {
            // If old value was an object, its cssUrl is the comparable part
            effectiveOldUrlForComparison = currentFontResource.cssUrl;
        }
        
        if (newUrl) {
            // Only call cacheFont if the new URL is actually different from what was effectively active.
            // This check is against the state *before* currentFontResource is updated by cacheFont.
            if (newUrl !== effectiveOldUrlForComparison) {
                console.log("SW: Storage change: New URL is different from current. Calling cacheFont for new URL:", newUrl);
                await cacheFont(newUrl); // cacheFont will handle clearing old and setting new currentFontResource
            } else {
                 console.log('SW: Storage change: New URL is the same as current effective URL. No caching action needed.');
            }
        } else { 
            // newUrl is empty, meaning font selection was cleared in options
            if (effectiveOldUrlForComparison) { // Only clear if there was something effectively cached
                console.log('SW: Storage change: selectedFontUrl cleared. Calling clearAndResetCurrentFontResource.');
                await clearAndResetCurrentFontResource();
            } else {
                console.log('SW: Storage change: selectedFontUrl cleared, but nothing was effectively cached. No action needed.');
            }
        }
    }
});

self.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;
    console.log("SW: Fetch event for:", requestUrl, "Mode:", event.request.mode, "Destination:", event.request.destination);
    console.log("SW: Current font resource state:", JSON.stringify(currentFontResource));

    if (!currentFontResource) {
        return;
    }

    let shouldIntercept = false;
    if (typeof currentFontResource === 'string') { 
        if (requestUrl === currentFontResource) {
            shouldIntercept = true;
        }
    } else if (typeof currentFontResource === 'object' && currentFontResource.cssUrl) { 
        if (requestUrl === currentFontResource.cssUrl) {
            shouldIntercept = true;
        } else if (currentFontResource.fontAssetUrls && currentFontResource.fontAssetUrls.includes(requestUrl)) {
            shouldIntercept = true;
        }
    }

    if (shouldIntercept) {
        console.log("SW: Matched request for caching:", requestUrl);
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    console.log("SW: Serving from cache:", requestUrl);
                    return cachedResponse;
                }
                console.log("SW: Not in cache, attempting network fetch for:", requestUrl);
                return fetch(event.request).then(async (networkResponse) => {
                    if (networkResponse.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            console.log("SW: Caching resource during network fallback:", requestUrl);
                            await cache.put(requestUrl, networkResponse.clone());
                            console.log("SW: Resource cached successfully during network fallback:", requestUrl);
                        } catch (cacheError) {
                            console.error('SW: Error caching resource during fallback fetch:', cacheError.message, cacheError.stack);
                        }
                    } else {
                        console.error('SW: Fallback network fetch failed. Status:', networkResponse.status, requestUrl);
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error('SW: Fallback network fetch error for resource:', error.message, error.stack, requestUrl);
                    throw error; 
                });
            })
        );
    }
});

console.log('SW: Script loaded (v2 with extensive logging) and event listeners attached.');
