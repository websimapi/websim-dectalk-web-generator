document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const audioUpload = document.getElementById('audio-upload');
    const fileName = document.getElementById('file-name');
    const playerContainer = document.getElementById('player-container');
    const audioPlayer = document.getElementById('audio-player');
    const convertButton = document.getElementById('convert-button');
    const dectalkContainer = document.getElementById('dectalk-container');
    const dectalkPlayer = document.getElementById('dectalk-player');
    const dectalkText = document.getElementById('dectalk-text');
    const playDectalk = document.getElementById('play-dectalk');
    const stopDectalk = document.getElementById('stop-dectalk');
    const copyText = document.getElementById('copy-text');
    const inputText = document.getElementById('input-text');
    const loadText = document.getElementById('load-text');
    
    // Log DOM element status for debugging
    debugLog('DOM Elements loaded', {
        audioUpload: !!audioUpload,
        playerContainer: !!playerContainer,
        dectalkContainer: !!dectalkContainer,
        dectalkText: !!dectalkText
    });
    
    // Debug logger function
    function debugLog(message, data) {
        console.log(`%c[DECTalk Debug] ${message}`, 'color: #3498db; font-weight: bold;', data || '');
    }
    
    // Error logger function
    function errorLog(message, error) {
        console.error(`%c[DECTalk Error] ${message}`, 'color: #e74c3c; font-weight: bold;', error || '');
    }
    
    // Initialize variables directly instead of dynamic import
    let dectalk = null;
    let audioContext = null;
    let audioBuffer = null;
    let isPlaying = false;
    let source = null;
    let sam = null;
    let meydaAnalyzer = null;
    
    // Check libraries on startup
    debugLog('Checking libraries availability');
    if (typeof window.SamJs === 'function') {
        debugLog('SamJs found in window scope', window.SamJs);
    } else if (typeof window.samjs === 'function') {
        debugLog('samjs found in window scope', window.samjs);
        window.SamJs = window.samjs;
    } else if (typeof window.SAM === 'function') {
        debugLog('SAM found in window scope', window.SAM);
        window.SamJs = window.SAM;
    } else if (typeof SamJs === 'function') {
        debugLog('SamJs found in global scope', SamJs);
        window.SamJs = SamJs;
    } else if (typeof samjs === 'function') {
        debugLog('samjs found in global scope', samjs);
        window.SamJs = samjs;
    } else {
        errorLog('Speech synthesis library (SamJs/SAM) not found', {
            'window.SamJs': typeof window.SamJs,
            'window.samjs': typeof window.samjs,
            'window.SAM': typeof window.SAM,
            'SamJs': typeof SamJs,
            'samjs': typeof samjs,
            'SAM': typeof SAM
        });
        // Try to load SamJs directly 
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/sam-js@0.3.1/dist/samjs.min.js";
        script.onload = () => debugLog('SamJs loaded dynamically');
        script.onerror = (e) => errorLog('Failed to load SamJs dynamically', e);
        document.head.appendChild(script);
    }
    
    // Initialize DECTalk
    function initDECTalk() {
        debugLog('Initializing DECTalk');
        
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                debugLog('AudioContext created', audioContext);
            } catch (err) {
                errorLog('Failed to create AudioContext', err);
                alert('Error: Could not create audio context. Please try a different browser.');
            }
        }
        
        if (!sam) {
            try {
                // Comprehensive check for SamJs with detailed debugging
                let SamConstructor = null;
                
                // Check for all possible variants of the constructor
                if (typeof window.SamJs === 'function') {
                    debugLog('Using window.SamJs constructor');
                    SamConstructor = window.SamJs;
                } else if (typeof window.samjs === 'function') {
                    debugLog('Using window.samjs constructor');
                    SamConstructor = window.samjs;
                } else if (typeof SamJs === 'function') {
                    debugLog('Using global SamJs constructor');
                    SamConstructor = SamJs;
                } else if (typeof samjs === 'function') {
                    debugLog('Using global samjs constructor');
                    SamConstructor = samjs;
                } else {
                    const err = new Error('Speech synthesis library not found');
                    errorLog('Could not find SAM or SamJs constructors', {
                        'window.SamJs': typeof window.SamJs,
                        'window.samjs': typeof window.samjs,
                        'window.SAM': typeof window.SAM, 
                        'SamJs': typeof SamJs,
                        'samjs': typeof samjs,
                        'SAM': typeof SAM
                    });
                    throw err;
                }
                
                // Create with proper error handling
                debugLog('Creating sam using constructor', SamConstructor);
                sam = new SamConstructor();
                
                // Verify sam was created
                if (sam) {
                    debugLog('Sam instance created successfully', sam);
                    // Test functionality
                    if (typeof sam.buf8 !== 'function' && typeof sam.speak !== 'function') {
                        throw new Error('Sam instance missing required methods');
                    }
                } else {
                    throw new Error('Failed to create Sam instance');
                }
            } catch (err) {
                errorLog('Failed to initialize speech synthesis', err);
                alert('Speech synthesis library not loaded properly. Please try refreshing the page or using a different browser.');
                return false;
            }
        }
        
        if (!dectalk) {
            debugLog('Creating dectalk interface');
            dectalk = {
                textToSpeech: function(text) {
                    debugLog('Converting text to speech', text.substring(0, 50) + '...');
                    // Process the DECTalk-style text and convert to audio
                    let processedText = processDECTalkText(text);
                    debugLog('Processed text', processedText.substring(0, 50) + '...');
                    
                    // Use SAM.js to generate speech
                    try {
                        if (!sam) {
                            throw new Error('Speech synthesis not initialized');
                        }
                        
                        // Check which method is available
                        let audioData;
                        if (typeof sam.buf8 === 'function') {
                            debugLog('Using sam.buf8 method');
                            audioData = sam.buf8(processedText);
                        } else if (typeof sam.speak === 'function') {
                            debugLog('Using sam.speak method');
                            audioData = sam.speak(processedText);
                        } else {
                            throw new Error('No valid speech synthesis method found');
                        }
                        
                        debugLog('Generated audio data', { length: audioData.length });
                        
                        // Convert to AudioBuffer
                        const buffer = audioContext.createBuffer(1, audioData.length, 22050);
                        const channelData = buffer.getChannelData(0);
                        
                        // Convert 8-bit audio to float
                        for (let i = 0; i < audioData.length; i++) {
                            channelData[i] = (audioData[i] - 128) / 128.0;
                        }
                        
                        return buffer;
                    } catch (err) {
                        errorLog('Failed to generate speech', err);
                        throw new Error('Error generating speech: ' + err.message);
                    }
                },
                analyze: function(audioBuffer) {
                    // Extract features from the audio
                    const features = extractAudioFeatures(audioBuffer);
                    
                    // Convert features to DECTalk format
                    const dectalkString = featuresToDECTalk(features);
                    
                    return dectalkString;
                }
            };
        }
        
        return true; // Return true if initialization was successful
    }
    
    // Process DECTalk text to make it compatible with SAM.js
    function processDECTalkText(text) {
        // Remove DECTalk-specific commands and convert to SAM format
        let processed = text;
        
        // Remove rate, pitch, and other DECTalk commands
        processed = processed.replace(/\[:([a-z]+)\s*([0-9]+)\]/gi, '');
        processed = processed.replace(/\[:([a-z]+)\]/gi, '');
        processed = processed.replace(/\[([a-z]+)\]/gi, '');
        
        // Remove phoneme markers
        processed = processed.replace(/\[:phoneme [a-z]+\]/gi, '');
        
        // Simple text cleanup
        return processed.replace(/[^\w\s]/gi, '').trim();
    }
    
    // Extract audio features using Meyda
    function extractAudioFeatures(buffer) {
        const features = {
            words: [],
            pitch: [],
            volume: [],
            speed: 180, // Default speed
            phonemes: []
        };
        
        try {
            // Get audio data
            const audioData = buffer.getChannelData(0);
            const sampleRate = buffer.sampleRate;
            
            // Configure Meyda for feature extraction
            const frameSize = 1024;
            const hopSize = 512;
            
            // Create offline analyzer
            for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
                const frame = audioData.slice(i, i + frameSize);
                
                // Use Meyda to extract features
                const frameFeatures = Meyda.extract(["rms", "spectralCentroid"], frame, sampleRate);
                
                // Store volume (rms)
                features.volume.push(frameFeatures.rms);
                
                // Store pitch estimation from spectral centroid
                features.pitch.push(frameFeatures.spectralCentroid);
            }
            
            // Generate approximately 5-10 words based on audio length
            const wordCount = Math.max(5, Math.min(10, Math.floor(buffer.duration * 2)));
            
            // Generate placeholder words
            const wordOptions = ["hello", "world", "this", "is", "dectalk", "speech", "synthesis", "robot", "voice", "computer"];
            for (let i = 0; i < wordCount; i++) {
                features.words.push(wordOptions[Math.floor(Math.random() * wordOptions.length)]);
            }
            
            // Determine speech rate based on audio length and estimated word count
            features.speed = Math.round(180 * (wordCount / buffer.duration) / 3);
            features.speed = Math.max(120, Math.min(250, features.speed)); // Clamp to reasonable range
            
        } catch (error) {
            errorLog("Error extracting features", error);
        }
        
        return features;
    }
    
    // Convert features to DECTalk format
    function featuresToDECTalk(features) {
        let dectalkText = "";
        
        // Add DECTalk header with speed setting
        dectalkText += `[:nh][:rate ${features.speed}][:phoneme arpabet]`;
        
        // Add words with punctuation
        let sentence = features.words.join(" ");
        
        // Add some variation based on the extracted features
        if (features.pitch.length > 0) {
            // Check if pitch varies a lot (question mark)
            const pitchVariation = Math.max(...features.pitch) / Math.min(...features.pitch);
            if (pitchVariation > 2) {
                sentence += "?";
            } else {
                sentence += ".";
            }
        }
        
        dectalkText += sentence;
        
        return dectalkText;
    }
    
    // File upload handler
    audioUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        debugLog('File selected', { name: file.name, type: file.type, size: file.size });
        fileName.textContent = file.name;
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL;
        playerContainer.classList.remove('hidden');
        
        // Read the audio file
        const initialized = initDECTalk();
        if (!initialized) {
            errorLog('DECTalk initialization failed');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                debugLog('File loaded, decoding audio data');
                const arrayBuffer = e.target.result;
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                debugLog('Audio decoded successfully', { 
                    duration: audioBuffer.duration,
                    channels: audioBuffer.numberOfChannels,
                    sampleRate: audioBuffer.sampleRate
                });
            } catch (err) {
                errorLog('Error decoding audio data', err);
                alert('Error decoding audio file. Please try a different format (WAV or MP3).');
            }
        };
        reader.onerror = function(err) {
            errorLog('Error reading file', err);
            alert('Error reading audio file. Please try again.');
        };
        reader.readAsArrayBuffer(file);
    });
    
    // Convert button handler
    convertButton.addEventListener('click', function() {
        if (!audioBuffer) {
            alert('Please upload an audio file first');
            return;
        }
        
        try {
            debugLog('Starting conversion process');
            // Display loading message
            this.textContent = "Converting...";
            this.disabled = true;
            
            // Use setTimeout to allow UI to update before heavy processing
            setTimeout(() => {
                try {
                    // Convert audio to DECTalk format
                    const dectalkString = dectalk.analyze(audioBuffer);
                    debugLog('Generated DECTalk string', dectalkString.substring(0, 50) + '...');
                    
                    // Check if dectalkText element exists before setting value
                    if (dectalkText) {
                        dectalkText.value = dectalkString;
                    } else {
                        errorLog('dectalkText element not found', document.getElementById('dectalk-text'));
                        throw new Error('UI element not found: dectalkText');
                    }
                    
                    // Generate audio from DECTalk
                    debugLog('Generating speech from DECTalk string');
                    const generatedBuffer = dectalk.textToSpeech(dectalkString);
                    debugLog('Speech generated', { 
                        duration: generatedBuffer.duration,
                        channels: generatedBuffer.numberOfChannels,
                        sampleRate: generatedBuffer.sampleRate
                    });
                    
                    const blob = bufferToWave(generatedBuffer, 0, generatedBuffer.length);
                    if (dectalkPlayer) {
                        dectalkPlayer.src = URL.createObjectURL(blob);
                    } else {
                        errorLog('dectalkPlayer element not found');
                    }
                    
                    if (dectalkContainer) {
                        dectalkContainer.classList.remove('hidden');
                    }
                    
                    // Reset button
                    convertButton.textContent = "Convert to DECTalk";
                    convertButton.disabled = false;
                } catch (err) {
                    errorLog('Error converting to DECTalk', err);
                    alert('Error converting to DECTalk: ' + err.message);
                    convertButton.textContent = "Convert to DECTalk";
                    convertButton.disabled = false;
                }
            }, 100);
            
        } catch (err) {
            errorLog('Error in conversion process', err);
            alert('Error converting to DECTalk: ' + err.message);
            convertButton.textContent = "Convert to DECTalk";
            convertButton.disabled = false;
        }
    });
    
    // Play/Stop DECTalk
    playDectalk.addEventListener('click', function() {
        if (isPlaying) return;
        
        const text = dectalkText.value;
        if (!text) return;
        
        initDECTalk();
        const buffer = dectalk.textToSpeech(text);
        source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        source.onended = function() {
            isPlaying = false;
        };
        isPlaying = true;
    });
    
    stopDectalk.addEventListener('click', function() {
        if (!isPlaying || !source) return;
        source.stop();
        isPlaying = false;
    });
    
    // Copy DECTalk text
    copyText.addEventListener('click', function() {
        dectalkText.select();
        document.execCommand('copy');
        alert('DECTalk text copied to clipboard');
    });
    
    // Load from text
    loadText.addEventListener('click', function() {
        const text = inputText?.value?.trim() || '';
        if (!text) {
            alert('Please enter DECTalk text');
            return;
        }
        
        const initialized = initDECTalk();
        if (!initialized) {
            errorLog('DECTalk initialization failed when loading from text');
            return;
        }
        
        try {
            // Generate audio from DECTalk text
            const buffer = dectalk.textToSpeech(text);
            const blob = bufferToWave(buffer, 0, buffer.length);
            if (dectalkPlayer) {
                dectalkPlayer.src = URL.createObjectURL(blob);
            } else {
                errorLog('dectalkPlayer element not found');
                throw new Error('UI element not found: dectalkPlayer');
            }
            
            if (dectalkText) {
                dectalkText.value = text;
            } else {
                errorLog('dectalkText element not found');
                throw new Error('UI element not found: dectalkText');
            }
            
            if (dectalkContainer) {
                dectalkContainer.classList.remove('hidden');
            } else {
                errorLog('dectalkContainer element not found');
            }
        } catch (err) {
            errorLog('Error loading DECTalk', err);
            alert('Error loading DECTalk: ' + err.message);
        }
    });
    
    // Helper function to convert AudioBuffer to WAV Blob
    function bufferToWave(buffer, start, end) {
        try {
            debugLog('Converting AudioBuffer to WAV', { start, end });
            const numOfChan = buffer.numberOfChannels;
            const length = (end - start) * numOfChan * 2 + 44;
            const output = new ArrayBuffer(length);
            const view = new DataView(output);
            const sampleRate = buffer.sampleRate;
            
            // RIFF header
            writeString(view, 0, 'RIFF');
            view.setUint32(4, length - 8, true);
            writeString(view, 8, 'WAVE');
            
            // FMT header
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, numOfChan, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numOfChan * 2, true);
            view.setUint16(32, numOfChan * 2, true);
            view.setUint16(34, 16, true);
            
            // Data header
            writeString(view, 36, 'data');
            view.setUint32(40, length - 44, true);
            
            // Write data
            const channelData = [];
            let offset = 44;
            
            for (let i = 0; i < numOfChan; i++) {
                channelData.push(buffer.getChannelData(i));
            }
            
            for (let i = start; i < end; i++) {
                for (let channel = 0; channel < numOfChan; channel++) {
                    const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                    offset += 2;
                }
            }
            
            return new Blob([view], { type: 'audio/wav' });
        } catch (err) {
            errorLog('Error converting buffer to WAV', err);
            throw new Error('Failed to create audio file: ' + err.message);
        }
    }
    
    // Helper to write strings to DataView
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    debugLog('DECTalk Web Generator initialized');
});