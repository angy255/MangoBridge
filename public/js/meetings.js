// meeting recording and summarization
const API_MEETINGS_URL = '/api/meetings';
let meetingRecorder = null;
let meetingAudioChunks = [];
let isMeetingRecording = false;
let isTranscriptEditing = false;
let currentTranscript = '';
let currentTranslation = '';
let currentSummary = '';

// meeting record button
let meetingRecordBtn = document.getElementById('meetingRecordBtn');
if (meetingRecordBtn) {
    meetingRecordBtn.addEventListener('click', toggleMeetingRecording);
}

async function toggleMeetingRecording() {
    if (isMeetingRecording) {
        stopMeetingRecording();
    } else {
        await startMeetingRecording();
    }
}

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
            currentTranscript = data.transcript;
            const transcriptDiv = document.getElementById('meetingTranscript');
            transcriptDiv.textContent = data.transcript;
            transcriptDiv.setAttribute('data-original', data.transcript);
            
            // Show buttons
            showEditButton();
            document.getElementById('transcriptActions').style.display = 'flex';
            
            showNotification('Meeting transcribed successfully!', 'success');
        } else {
            showNotification(data.error || 'Transcription failed', 'error');
        }
    } catch (error) {
        console.error('Transcription error:', error);
        showNotification('Failed to transcribe meeting', 'error');
    }
}

function showEditButton() {
    const editBtnContainer = document.getElementById('editTranscriptBtnContainer');
    if (editBtnContainer) {
        editBtnContainer.style.display = 'block';
    }
}

let editTranscriptBtn = document.getElementById('editTranscriptBtn');
if (editTranscriptBtn) {
    editTranscriptBtn.addEventListener('click', toggleEditTranscript);
}

function toggleEditTranscript() {
    const transcriptDiv = document.getElementById('meetingTranscript');
    const editBtn = document.getElementById('editTranscriptBtn');
    
    if (isTranscriptEditing) {
        const textarea = transcriptDiv.querySelector('textarea');
        if (textarea) {
            currentTranscript = textarea.value;
            transcriptDiv.textContent = textarea.value;
            transcriptDiv.setAttribute('data-original', textarea.value);
        }
        isTranscriptEditing = false;
        editBtn.innerHTML = '✏️ Edit Transcript';
        editBtn.classList.remove('btn-success');
        editBtn.classList.add('btn-secondary');
    } else {
        const currentText = transcriptDiv.textContent;
        transcriptDiv.innerHTML = `<textarea style="width: 100%; min-height: 200px; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-family: inherit; font-size: 14px;">${currentText}</textarea>`;
        isTranscriptEditing = true;
        editBtn.innerHTML = '💾 Save Changes';
        editBtn.classList.remove('btn-secondary');
        editBtn.classList.add('btn-success');
    }
}

let translateTranscriptBtn = document.getElementById('translateTranscriptBtn');
if (translateTranscriptBtn) {
    translateTranscriptBtn.addEventListener('click', translateMeetingTranscript);
}

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
            currentTranslation = data.translation;
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

let summarizeBtn = document.getElementById('summarizeBtn');
if (summarizeBtn) {
    summarizeBtn.addEventListener('click', summarizeMeeting);
}

async function summarizeMeeting() {
    const transcriptDiv = document.getElementById('meetingTranscript');
    const transcript = transcriptDiv.textContent;
    
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
            currentSummary = data.summary;
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

let saveSummaryBtn = document.getElementById('saveSummaryBtn');
if (saveSummaryBtn) {
    saveSummaryBtn.addEventListener('click', saveMeetingSummary);
}

async function saveMeetingSummary() {
    const titlePrompt = prompt('Enter a title for this meeting summary:');
    
    if (!titlePrompt || titlePrompt.trim() === '') {
        showNotification('Title is required to save summary', 'error');
        return;
    }
    
    const sourceLang = document.getElementById('meetingSourceLang').value;
    const targetLang = document.getElementById('meetingTargetLang').value;
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/save-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: titlePrompt.trim(),
                meetingDate: new Date(),
                transcript: currentTranscript,
                translatedTranscript: currentTranslation,
                summary: currentSummary,
                sourceLang: sourceLang,
                targetLang: targetLang
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Meeting summary saved successfully! View it in the Meeting Summaries tab.', 'success');
            
            // Reset the form
            document.getElementById('meetingTranscript').innerHTML = '<p style="color: #999;">Transcript will appear here after recording...</p>';
            document.getElementById('meetingSummary').style.display = 'none';
            document.getElementById('editTranscriptBtnContainer').style.display = 'none';
            document.getElementById('transcriptActions').style.display = 'none';
            
            currentTranscript = '';
            currentTranslation = '';
            currentSummary = '';
        } else {
            showNotification(data.error || 'Failed to save summary', 'error');
        }
    } catch (error) {
        console.error('Error saving summary:', error);
        showNotification('Failed to save summary', 'error');
    }
}

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

function getLanguageName(code) {
    const names = {
        en: 'English', es: 'Spanish', fr: 'French', de: 'German',
        zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', it: 'Italian',
        nl: 'Dutch', pl: 'Polish', ru: 'Russian', ko: 'Korean', 
        tr: 'Turkish'
    };
    return names[code] || code.toUpperCase();
}