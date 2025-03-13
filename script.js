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
    
    // Initialize DECTalk synthesizer
    let dectalk = null;
    let audioContext = null;
    let audioBuffer = null;
    let isPlaying = false;
    let source = null;
    
    // Initialize DECTalk
    function initDECTalk() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!dectalk) {
            // This is a placeholder for the actual DECTalk initialization
            // In a real implementation, you would use the actual DECTalk library
            dectalk = {
                textToSpeech: function(text) {
                    // This would be replaced with actual DECTalk processing
                    // For demo purposes, we're creating a simple audio signal
                    const sampleRate = audioContext.sampleRate;
                    const duration = text.length * 0.1; // Rough estimate
                    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
                    const data = buffer.getChannelData(0);
                    
                    // Generate a simple tone for demonstration
                    for (let i = 0; i < data.length; i++) {
                        const t = i / sampleRate;
                        data[i] = Math.sin(440 * Math.PI * 2 * t) * Math.exp(-3 * t);
                    }
                    
                    return buffer;
                },
                analyze: function(audioBuffer) {
                    // This would analyze audio and convert to DECTalk format
                    // For demo, return dummy text
                    return "[:nh][:rate 180][:phoneme arpabet]Hello, this is DECTalk. Your audio has been converted.";
                }
            };
        }
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
            // Convert audio to DECTalk format
            const dectalkString = dectalk.analyze(audioBuffer);
            dectalkText.value = dectalkString;
            
            // Generate audio from DECTalk
            const generatedBuffer = dectalk.textToSpeech(dectalkString);
            const blob = bufferToWave(generatedBuffer, 0, generatedBuffer.length);
            dectalkPlayer.src = URL.createObjectURL(blob);
            
            dectalkContainer.classList.remove('hidden');
        } catch (err) {
            console.error('Error converting to DECTalk', err);
            alert('Error converting to DECTalk: ' + err.message);
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

