/**
 * Say.js - DECTalk Web Interface
 * Based on the implementation from https://webspeak.terminal.ink/
 * Provides text-to-speech functionality using the DECTalk synthesis
 */

(function() {
    'use strict';
    
    // Default DECTalk API endpoint - this should be replaced with a working endpoint
    const API_ENDPOINT = 'https://tts.webspeak.terminal.ink/api';
    
    // Cache for audio URLs to avoid unnecessary requests
    const audioCache = new Map();
    
    /**
     * Say.js API object
     */
    window.Say = {
        /**
         * Convert text to speech and return a playable audio URL
         * @param {string} text - The DECTalk format text to convert
         * @param {string} format - Audio format (wav, mp3, ogg)
         * @param {Object} options - Additional options
         * @returns {string} URL to the generated audio
         */
        say: function(text, format = 'wav', options = {}) {
            // Check if we have this in cache already
            const cacheKey = `${text}-${format}-${JSON.stringify(options)}`;
            if (audioCache.has(cacheKey)) {
                console.log('[Say.js] Returning cached audio URL');
                return audioCache.get(cacheKey);
            }
            
            // If we're in a browser that supports data URIs for audio,
            // we can create a proper object URL 
            try {
                // For demo purposes, we'll generate a dummy URL
                // In production, this would call the actual API
                if (options.useApi) {
                    // Convert the text to a URL-safe format
                    const encodedText = encodeURIComponent(text);
                    
                    // Build the API URL
                    const apiUrl = `${API_ENDPOINT}/say?text=${encodedText}&format=${format}`;
                    
                    // In a real implementation, we would make a fetch request
                    // For now, we'll just return the API URL
                    console.log('[Say.js] Generated API URL for TTS');
                    audioCache.set(cacheKey, apiUrl);
                    return apiUrl;
                } else {
                    // Generate a mock audio URL - a small silent WAV file
                    // In a real implementation, this would generate actual audio from the text
                    const silentWavBase64 = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQYAAAAAAAAAAAAAAAAAAAAA";
                    
                    // Log the DECTalk text for debugging
                    console.log('[Say.js] Generated mock audio for text:', text);
                    
                    // Cache and return the mock audio
                    audioCache.set(cacheKey, silentWavBase64);
                    return silentWavBase64;
                }
            } catch (error) {
                console.error('[Say.js] Error generating speech:', error);
                return null;
            }
        },
        
        /**
         * Check if the Say.js API is available
         * @returns {boolean} True if the API is available
         */
        isAvailable: function() {
            // In a real implementation, this would check API connectivity
            return true;
        },
        
        /**
         * Get the current API endpoint
         * @returns {string} Current API endpoint URL
         */
        getApiEndpoint: function() {
            return API_ENDPOINT;
        },
        
        /**
         * Parse DECTalk text and extract phonetic information
         * @param {string} text - DECTalk format text
         * @returns {Object} Parsed phonetic information
         */
        parsePhonetics: function(text) {
            // This is a simplified parser for demo purposes
            // A real implementation would parse the DECTalk commands
            
            const result = {
                commands: [],
                words: [],
                rawText: text
            };
            
            // Extract DECTalk commands (e.g., [:rate 180])
            const commandRegex = /\[:([\w]+)\s*([0-9]*)\]/g;
            let match;
            
            while ((match = commandRegex.exec(text)) !== null) {
                result.commands.push({
                    type: match[1],
                    value: match[2] ? parseInt(match[2], 10) : null
                });
            }
            
            // Extract plain text (simplified)
            const plainText = text.replace(/\[:[\w]+\s*[0-9]*\]/g, '').trim();
            result.words = plainText.split(/\s+/);
            
            return result;
        },
        
        /**
         * Clear the audio cache
         */
        clearCache: function() {
            audioCache.clear();
            console.log('[Say.js] Audio cache cleared');
        }
    };
    
    console.log('[Say.js] DECTalk speech synthesis interface initialized');
})();