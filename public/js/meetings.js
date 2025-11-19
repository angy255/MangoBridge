// meeting recording and summarization
// use api here?
const API_MEETINGS_URL = '/api/meetings';
let meetingRecorder = null;
let meetingAudioChunks = [];
let isMeetingRecording = false;
let isTranscriptEditing = false;

// meeting record button
let meetingRecordBtn = document.getElementById('meetingRecordBtn');
if (meetingRecordBtn) {
    meetingRecordBtn.addEventListener('click', toggleMeetingRecording);
}

// toggle meeting recording
async function toggleMeetingRecording() {
    if (isMeetingRecording) {
        stopMeetingRecording();
    } else {
        await startMeetingRecording();
    }
}

// start meeting recording
async function startMeetingRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        meetingRecorder = new MediaRecorder(stream);
        meetingAudioChunks = [];
        
        meetingRecorder.addEventListener('dataavailable', event => {
            meetingAudioChunks.push(event.data);
        });
        
        meetingRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(meetingAudioChunks, { type: 'audio/webm' });
            await transcribeMeeting(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        });
        
        meetingRecorder.start();
        isMeetingRecording = true;
        
        const btn = document.getElementById('meetingRecordBtn');
        btn.innerHTML = '⏹️ Stop Recording';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-warning');
        btn.style.animation = 'pulse 1.5s infinite';
        
        showNotification('Recording meeting...', 'success');
    } catch (error) {
        console.error('Microphone error:', error);
        showNotification('Could not access microphone', 'error');
    }
}

// stop meeting recording
function stopMeetingRecording() {
    if (meetingRecorder && isMeetingRecording) {
        meetingRecorder.stop();
        isMeetingRecording = false;
        
        const btn = document.getElementById('meetingRecordBtn');
        btn.innerHTML = '🎤 Start Recording';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-danger');
        btn.style.animation = 'none';
    }
}

// transcribe meeting
async function transcribeMeeting(audioBlob) {
    const language = document.getElementById('meetingSourceLang').value;
    
    showNotification('Transcribing meeting...', 'success');
    
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'meeting.webm');
        formData.append('language', language);
        
        const response = await fetch(`${API_MEETINGS_URL}/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const transcriptDiv = document.getElementById('meetingTranscript');
            transcriptDiv.textContent = data.transcript;
            transcriptDiv.setAttribute('data-original', data.transcript);
            showEditButton();
            showNotification('Meeting transcribed successfully!', 'success');
        } else {
            showNotification(data.error || 'Transcription failed', 'error');
        }
    } catch (error) {
        console.error('Transcription error:', error);
        showNotification('Failed to transcribe meeting', 'error');
    }
}

// show edit button
function showEditButton() {
    const editBtnContainer = document.getElementById('editTranscriptBtnContainer');
    if (editBtnContainer) {
        editBtnContainer.style.display = 'block';
    }
}

// Edit transcript button
let editTranscriptBtn = document.getElementById('editTranscriptBtn');
if (editTranscriptBtn) {
    editTranscriptBtn.addEventListener('click', toggleEditTranscript);
}

// Toggle edit transcript
function toggleEditTranscript() {
    const transcriptDiv = document.getElementById('meetingTranscript');
    const editBtn = document.getElementById('editTranscriptBtn');
    
    if (isTranscriptEditing) {
        // Save changes
        const textarea = transcriptDiv.querySelector('textarea');
        if (textarea) {
            transcriptDiv.textContent = textarea.value;
            transcriptDiv.setAttribute('data-original', textarea.value);
        }
        isTranscriptEditing = false;
        editBtn.innerHTML = '✏️ Edit Transcript';
        editBtn.classList.remove('btn-success');
        editBtn.classList.add('btn-secondary');
    } else {
        // Enable editing
        const currentText = transcriptDiv.textContent;
        transcriptDiv.innerHTML = `<textarea style="width: 100%; min-height: 200px; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-family: inherit; font-size: 14px;">${currentText}</textarea>`;
        isTranscriptEditing = true;
        editBtn.innerHTML = '💾 Save Changes';
        editBtn.classList.remove('btn-secondary');
        editBtn.classList.add('btn-success');
    }
}

// Preview translation button
let previewTranslationBtn = document.getElementById('previewTranslationBtn');
if (previewTranslationBtn) {
    previewTranslationBtn.addEventListener('click', previewTranslation);
}

// Preview translation
async function previewTranslation() {
    const transcript = document.getElementById('meetingTranscript').textContent;
    const sourceLang = document.getElementById('meetingSourceLang').value;
    const targetLang = document.getElementById('meetingTargetLang').value;
    
    if (!transcript || transcript.includes('Transcript will appear')) {
        showNotification('No transcript to preview', 'error');
        return;
    }
    
    showNotification('Generating translation preview...', 'success');
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: transcript,
                sourceLang: sourceLang,
                targetLang: targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const previewBox = document.getElementById('translationPreviewBox');
            const previewContent = document.getElementById('translationPreviewContent');
            
            previewContent.innerHTML = `
                <strong>Translation Preview (${getLanguageName(targetLang)}):</strong><br><br>
                ${escapeHtml(data.translation)}
            `;
            
            previewBox.style.display = 'block';
            showNotification('Translation preview generated!', 'success');
        }
    } catch (error) {
        console.error('Translation preview error:', error);
        showNotification('Failed to generate translation preview', 'error');
    }
}

// Translate transcript button
let translateTranscriptBtn = document.getElementById('translateTranscriptBtn');
if (translateTranscriptBtn) {
    translateTranscriptBtn.addEventListener('click', translateMeetingTranscript);
}

// Translate meeting transcript
async function translateMeetingTranscript() {
    const transcript = document.getElementById('meetingTranscript').textContent;
    const sourceLang = document.getElementById('meetingSourceLang').value;
    const targetLang = document.getElementById('meetingTargetLang').value;
    
    if (!transcript || transcript.includes('Transcript will appear')) {
        showNotification('No transcript to translate', 'error');
        return;
    }
    
    showNotification('Translating transcript...', 'success');
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: transcript,
                sourceLang: sourceLang,
                targetLang: targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('meetingTranscript').innerHTML = `
                <strong>Translated to ${getLanguageName(targetLang)}:</strong><br><br>
                ${escapeHtml(data.translation)}
            `;
            showNotification('Transcript translated successfully!', 'success');
        }
    } catch (error) {
        console.error('Translation error:', error);
        showNotification('Failed to translate transcript', 'error');
    }
}

// Summarize button
let summarizeBtn = document.getElementById('summarizeBtn');
if (summarizeBtn) {
    summarizeBtn.addEventListener('click', summarizeMeeting);
}

// Summarize meeting
async function summarizeMeeting() {
    const transcript = document.getElementById('meetingTranscript').textContent;
    
    if (!transcript || transcript.includes('Transcript will appear')) {
        showNotification('No transcript to summarize', 'error');
        return;
    }
    
    showNotification('Generating summary with AI...', 'success');
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: transcript })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const summaryBox = document.getElementById('meetingSummary');
            const summaryContent = document.getElementById('summaryContent');
            
            summaryContent.innerHTML = formatSummary(data.summary);
            summaryBox.style.display = 'block';
            showNotification('Summary generated successfully!', 'success');
        } else {
            showNotification('Failed to generate summary', 'error');
        }
    } catch (error) {
        console.error('Summarization error:', error);
        showNotification('Failed to generate summary', 'error');
    }
}

// Format summary for display
function formatSummary(summary) {
    return summary
        .split('\n')
        .map(line => {
            line = line.trim();
            if (!line) return '';
            
            if (line.startsWith('- ') || line.startsWith('• ')) {
                return `<li>${escapeHtml(line.substring(2))}</li>`;
            }
            
            if (line.includes('**')) {
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            }
            
            return `<p>${line}</p>`;
        })
        .join('');
}

// Get language name
function getLanguageName(code) {
    const names = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', it: 'Italian',
        nl: 'Dutch', pl: 'Polish', ru: 'Russian', ko: 'Korean', 
        tr: 'Turkish'
    };
    return names[code] || code.toUpperCase();
}