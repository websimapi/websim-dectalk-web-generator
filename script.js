document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const audioUpload = document.getElementById('audio-upload');
    const fileName = document.getElementById('file-name');
    const playerContainer = document.getElementById('player-container');
    const audioPlayer = document.getElementById('audio-player');
    const convertButton = document.getElementById('convert-button');
    const dectalkContainer = document.getElementById('dectalk-container');
    const dectalkPlayer = document.getElementById('dectalk-player');
    const dectalkText = document.getElementById('dctalk-text');
    const playDectalk = document.getElementById('play-dectalk');
    const stopDectalk = document.getElementById('stop-dectalk');
    const copyText = document.getElementById('copy-text');
    const inputText = document.getElementById('input-text');
    const loadText = document.getElementById('load-text');
    
    // Initialize variables directly instead of dynamic import
    let dectalk = null;
    let audioContext = null;
    let audioBuffer = null;
    let isPlaying = false;
    let source = null;
    let sam = null;
    let meydaAnalyzer = null;
    
    // Initialize DECTalk
    function initDECTalk() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!sam) {
            // Fix for SamJs constructor access - it's exposed as 'SamJs' in the global scope
            if (typeof window.SamJs === 'function') {
                sam = new window.SamJs();
            } else if (typeof window.SAM === 'function') {
                sam = new window.SAM();
            } else if (typeof SamJs === 'function') {
                sam = new SamJs();
            } else {
                console.error('SamJs library not properly loaded');
                alert('Speech synthesis library not loaded properly. Please refresh the page and try again.');
            }
        }
        if (!dectalk) {
            dectalk = {
                textToSpeech: function(text) {
                    // Process the DECTalk-style text and convert to audio
                    let processedText = processDECTalkText(text);
                    
                    // Use SAM.js to generate speech
                    const audioData = sam.buf8(processedText);
                    
                    // Convert to AudioBuffer
                    const buffer = audioContext.createBuffer(1, audioData.length, 22050);
                    const channelData = buffer.getChannelData(0);
                    
                    // Convert 8-bit audio to float
                    for (let i = 0; i < audioData.length; i++) {
                        channelData[i] = (audioData[i] - 128) / 128.0;
                    }
                    
                    return buffer;
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
            console.error("Error extracting features:", error);
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
        
        fileName.textContent = file.name;
        const fileURL = URL.createObjectURL(file);
        audioPlayer.src = fileURL;
        playerContainer.classList.remove('hidden');
        
        // Read the audio file
        initDECTalk();
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            } catch (err) {
                console.error('Error decoding audio data', err);
                alert('Error decoding audio file. Please try a different format (WAV or MP3).');
            }
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
            // Display loading message
            this.textContent = "Converting...";
            this.disabled = true;
            
            // Use setTimeout to allow UI to update before heavy processing
            setTimeout(() => {
                try {
                    // Convert audio to DECTalk format
                    const dectalkString = dectalk.analyze(audioBuffer);
                    dectalkText.value = dectalkString;
                    
                    // Generate audio from DECTalk
                    const generatedBuffer = dectalk.textToSpeech(dectalkString);
                    const blob = bufferToWave(generatedBuffer, 0, generatedBuffer.length);
                    dectalkPlayer.src = URL.createObjectURL(blob);
                    
                    dectalkContainer.classList.remove('hidden');
                    
                    // Reset button
                    convertButton.textContent = "Convert to DECTalk";
                    convertButton.disabled = false;
                } catch (err) {
                    console.error('Error converting to DECTalk', err);
                    alert('Error converting to DECTalk: ' + err.message);
                    convertButton.textContent = "Convert to DECTalk";
                    convertButton.disabled = false;
                }
            }, 100);
            
        } catch (err) {
            console.error('Error converting to DECTalk', err);
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
        const text = inputText.value.trim();
        if (!text) {
            alert('Please enter DECTalk text');
            return;
        }
        
        initDECTalk();
        try {
            // Generate audio from DECTalk text
            const buffer = dectalk.textToSpeech(text);
            const blob = bufferToWave(buffer, 0, buffer.length);
            dectalkPlayer.src = URL.createObjectURL(blob);
            dectalkText.value = text;
            dectalkContainer.classList.remove('hidden');
        } catch (err) {
            console.error('Error loading DECTalk', err);
            alert('Error loading DECTalk: ' + err.message);
        }
    });
    
    // Helper function to convert AudioBuffer to WAV Blob
    function bufferToWave(buffer, start, end) {
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
    }
    
    // Helper to write strings to DataView
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
});