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
    
    // State variables
    let audioContext = null;
    let audioBuffer = null;
    let isPlaying = false;
    let currentAudioSource = null;
    
    // Debug logger function
    function debugLog(message, data) {
        console.log(`%c[DECTalk Debug] ${message}`, 'color: #3498db; font-weight: bold;', data || '');
    }
    
    // Error logger function
    function errorLog(message, error) {
        console.error(`%c[DECTalk Error] ${message}`, 'color: #e74c3c; font-weight: bold;', error || '');
    }
    
    // Initialize Audio Context
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                debugLog('AudioContext created', audioContext);
                return true;
            } catch (err) {
                errorLog('Failed to create AudioContext', err);
                alert('Error: Could not create audio context. Please try a different browser.');
                return false;
            }
        }
        return true;
    }
    
    // Convert audio features to DECTalk format
    function generateDectalkFromFeatures(features) {
        let dectalkText = "";
        
        // Add DECTalk header with speed and voice settings
        dectalkText += `[:nh][:rate ${features.rate || 180}][:phoneme arpabet]`;
        
        // Add some basic pitch modulation if we detected it
        if (features.pitchRange && features.pitchRange > 30) {
            dectalkText += `[:dv ap ${Math.min(100, Math.max(30, features.pitchRange))}]`;
        }
        
        // If we detected significant volume variation, add that
        if (features.volumeVariation && features.volumeVariation > 0.3) {
            dectalkText += `[:volume set ${Math.round(features.avgVolume * 100)}]`;
        }
        
        // Generate phoneme representation
        if (features.words && features.words.length > 0) {
            dectalkText += features.words.join(" ");
        } else {
            // Fallback text if no words detected
            dectalkText += "Hello. This is a DECTalk conversion from your audio.";
        }
        
        // Add ending punctuation based on pitch contour
        if (features.pitchContour === 'rising') {
            dectalkText += "?";
        } else if (features.pitchContour === 'falling') {
            dectalkText += ".";
        } else {
            dectalkText += ".";
        }
        
        return dectalkText;
    }
    
    // Extract audio features using Meyda
    function extractAudioFeatures(buffer) {
        debugLog('Extracting audio features from buffer', { 
            duration: buffer.duration, 
            channels: buffer.numberOfChannels, 
            sampleRate: buffer.sampleRate 
        });
        
        const features = {
            rate: 180, // default speech rate
            pitchRange: 0,
            avgPitch: 0,
            pitchContour: 'neutral',
            avgVolume: 0,
            volumeVariation: 0,
            words: []
        };
        
        try {
            // Get audio data from first channel
            const audioData = buffer.getChannelData(0);
            const sampleRate = buffer.sampleRate;
            
            // Configure frame analysis
            const frameSize = 1024;
            const hopSize = 512;
            const frames = Math.floor((audioData.length - frameSize) / hopSize);
            
            // Arrays to store frame-by-frame analysis
            const pitches = [];
            const volumes = [];
            
            // Process audio in frames
            for (let i = 0; i < frames; i++) {
                const frameStart = i * hopSize;
                const frame = audioData.slice(frameStart, frameStart + frameSize);
                
                // Use Meyda to extract frame features if available
                if (typeof Meyda !== 'undefined') {
                    const frameFeatures = Meyda.extract(["rms", "spectralCentroid", "zcr"], frame, sampleRate);
                    
                    // Store volume (RMS)
                    volumes.push(frameFeatures.rms);
                    
                    // Store pitch estimation from spectral centroid
                    // Convert to a more DECTalk-friendly range
                    const normalizedPitch = Math.min(300, Math.max(50, frameFeatures.spectralCentroid / 30));
                    pitches.push(normalizedPitch);
                    
                    // Use zero-crossing rate to help with phoneme detection
                    if (frameFeatures.zcr > 0.3) {
                        // High zero-crossing rate often indicates fricatives/sibilants
                    }
                } else {
                    // Simple volume detection if Meyda is not available
                    let sum = 0;
                    for (let j = 0; j < frameSize; j++) {
                        sum += Math.abs(frame[j]);
                    }
                    volumes.push(sum / frameSize);
                }
            }
            
            // Calculate average and variation of pitch
            if (pitches.length > 0) {
                features.avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
                
                // Calculate pitch range
                const minPitch = Math.min(...pitches);
                const maxPitch = Math.max(...pitches);
                features.pitchRange = maxPitch - minPitch;
                
                // Determine pitch contour
                const firstQuarterAvg = pitches.slice(0, Math.floor(pitches.length / 4))
                    .reduce((a, b) => a + b, 0) / Math.floor(pitches.length / 4);
                const lastQuarterAvg = pitches.slice(Math.floor(3 * pitches.length / 4))
                    .reduce((a, b) => a + b, 0) / (pitches.length - Math.floor(3 * pitches.length / 4));
                
                if (lastQuarterAvg > firstQuarterAvg * 1.2) {
                    features.pitchContour = 'rising'; // Question-like
                } else if (firstQuarterAvg > lastQuarterAvg * 1.2) {
                    features.pitchContour = 'falling'; // Statement-like
                }
            }
            
            // Calculate average and variation of volume
            if (volumes.length > 0) {
                features.avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
                
                // Calculate volume variation
                const volumeVariances = volumes.map(v => Math.pow(v - features.avgVolume, 2));
                features.volumeVariation = Math.sqrt(
                    volumeVariances.reduce((a, b) => a + b, 0) / volumes.length
                ) / features.avgVolume;
            }
            
            // Estimate speech rate based on volume variations and duration
            // Count significant volume changes as potential syllables
            let syllableCount = 0;
            let inSyllable = false;
            for (let i = 1; i < volumes.length; i++) {
                if (!inSyllable && volumes[i] > features.avgVolume * 1.2) {
                    inSyllable = true;
                    syllableCount++;
                } else if (inSyllable && volumes[i] < features.avgVolume * 0.8) {
                    inSyllable = false;
                }
            }
            
            // Calculate speech rate based on syllables per minute
            const duration = buffer.duration;
            const syllablesPerMinute = (syllableCount / duration) * 60;
            features.rate = Math.max(120, Math.min(250, Math.round(syllablesPerMinute / 2)));
            
            // Generate placeholders for words based on syllable count
            // In a real implementation, this would use actual speech recognition
            const wordOptions = [
                "hello", "world", "welcome", "to", "dectalk", "speech", "synthesis",
                "voice", "computer", "talking", "robot", "sound", "audio", "conversion"
            ];
            
            // Estimate word count (roughly 1.5 syllables per word)
            const estimatedWordCount = Math.max(4, Math.round(syllableCount / 1.5));
            
            // Generate placeholder words
            for (let i = 0; i < estimatedWordCount; i++) {
                features.words.push(wordOptions[Math.floor(Math.random() * wordOptions.length)]);
            }
            
            debugLog('Feature extraction complete', features);
            
        } catch (error) {
            errorLog('Error extracting audio features', error);
        }
        
        return features;
    }
    
    // File upload handler
    audioUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        debugLog('File selected', { name: file.name, type: file.type, size: file.size });
        fileName.textContent = file.name;
        
        // Create object URL for audio playback
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL;
        playerContainer.classList.remove('hidden');
        
        // Initialize audio context
        if (!initAudioContext()) return;
        
        // Read the audio file
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
                
                // Enable convert button once audio is loaded
                convertButton.disabled = false;
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
            convertButton.textContent = "Converting...";
            convertButton.disabled = true;
            
            // Use setTimeout to allow UI to update before heavy processing
            setTimeout(() => {
                try {
                    // Extract features from audio
                    const features = extractAudioFeatures(audioBuffer);
                    
                    // Generate DECTalk script from features
                    const dectalkString = generateDectalkFromFeatures(features);
                    debugLog('Generated DECTalk string', dectalkString);
                    
                    // Update the text area
                    if (dectalkText) {
                        dectalkText.value = dectalkString;
                    } else {
                        throw new Error('UI element not found: dectalkText');
                    }
                    
                    // Make the DECTalk container visible
                    if (dectalkContainer) {
                        dectalkContainer.classList.remove('hidden');
                    }
                    
                    // Try to play using Say.js if available
                    try {
                        if (typeof Say !== 'undefined' && Say.say) {
                            // Generate audio URL using Say.js
                            const audioUrl = Say.say(dectalkString, 'wav');
                            if (dectalkPlayer && audioUrl) {
                                dectalkPlayer.src = audioUrl;
                                debugLog('DECTalk audio generated with Say.js', audioUrl);
                            }
                        } else {
                            debugLog('Say.js not available for audio generation');
                        }
                    } catch (sayError) {
                        errorLog('Error generating audio with Say.js', sayError);
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
    
    // Play DECTalk using Say.js
    playDectalk.addEventListener('click', function() {
        if (isPlaying) return;
        
        const text = dectalkText.value;
        if (!text) {
            alert('No DECTalk text available');
            return;
        }
        
        try {
            if (typeof Say !== 'undefined' && Say.say) {
                debugLog('Playing DECTalk with Say.js', text);
                
                // Stop any currently playing audio
                if (currentAudioSource) {
                    currentAudioSource.pause();
                }
                
                // Generate audio and play it
                const audioUrl = Say.say(text, 'wav');
                if (audioUrl) {
                    currentAudioSource = new Audio(audioUrl);
                    currentAudioSource.onended = function() {
                        isPlaying = false;
                    };
                    currentAudioSource.play();
                    isPlaying = true;
                } else {
                    throw new Error('Failed to generate audio URL');
                }
            } else {
                throw new Error('Say.js not available');
            }
        } catch (err) {
            errorLog('Error playing DECTalk', err);
            alert('Error playing DECTalk: ' + err.message);
        }
    });
    
    // Stop DECTalk playback
    stopDectalk.addEventListener('click', function() {
        if (!isPlaying || !currentAudioSource) return;
        
        debugLog('Stopping DECTalk playback');
        currentAudioSource.pause();
        isPlaying = false;
    });
    
    // Copy DECTalk text
    copyText.addEventListener('click', function() {
        if (!dectalkText || !dectalkText.value) {
            alert('No DECTalk text available to copy');
            return;
        }
        
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
        
        debugLog('Loading from text input', text);
        
        try {
            // Update the DECTalk text area
            if (dectalkText) {
                dectalkText.value = text;
            } else {
                throw new Error('UI element not found: dectalkText');
            }
            
            // Try to generate audio with Say.js
            if (typeof Say !== 'undefined' && Say.say) {
                const audioUrl = Say.say(text, 'wav');
                if (dectalkPlayer && audioUrl) {
                    dectalkPlayer.src = audioUrl;
                    debugLog('Audio generated from text input', audioUrl);
                }
            } else {
                debugLog('Say.js not available for audio generation');
            }
            
            // Show the DECTalk container
            if (dectalkContainer) {
                dectalkContainer.classList.remove('hidden');
            }
        } catch (err) {
            errorLog('Error loading from text', err);
            alert('Error loading DECTalk from text: ' + err.message);
        }
    });
    
    debugLog('DECTalk Web Generator initialized');
});