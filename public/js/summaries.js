// meeting summaries management
// load meeting summaries
async function loadMeetingSummaries() {
    const API_MEETINGS_URL = '/api/meetings';
    const summariesList = document.getElementById('summariesList');
    const emptyState = document.getElementById('summariesEmptyState');
    
    if (!summariesList) {
        return;
    }
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/summaries`);
        const data = await response.json();
        
        if (data.success) {
            renderMeetingSummaries(data.data);
        }
    } catch (error) {
        console.error('Error loading summaries:', error);
        if (summariesList) {
            summariesList.innerHTML = '<div class="error" style="padding: 20px; text-align: center; color: #dc3545;">Failed to load summaries</div>';
        }
    }
}

function renderMeetingSummaries(summaries) {
    const container = document.getElementById('summariesList');
    const emptyState = document.getElementById('summariesEmptyState');
    
    if (!container) return;
    
    if (summaries.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    container.innerHTML = summaries.map(summary => `
        <div class="summary-card" data-id="${summary._id}">
            <div class="summary-header">
                <h3>${escapeHtml(summary.title)}</h3>
                <button class="icon-btn" onclick="deleteMeetingSummary('${summary._id}')" title="Delete summary">
                    🗑️
                </button>
            </div>
            <div class="summary-meta">
                <span>📅 Meeting: ${new Date(summary.meetingDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</span>
                <span>🕒 Generated: ${new Date(summary.generatedAt).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                })}</span>
            </div>
            <div class="summary-content">
                ${formatSummary(summary.summary)}
            </div>
            ${summary.transcript ? `
                <details style="margin-top: 15px;">
                    <summary style="cursor: pointer; color: #667eea; font-weight: 600; padding: 10px; background: #f0f7ff; border-radius: 5px;">
                        📝 View Full Transcript
                    </summary>
                    <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; line-height: 1.6; white-space: pre-wrap;">
                        ${escapeHtml(summary.transcript)}
                    </div>
                </details>
            ` : ''}
            ${summary.translatedTranscript ? `
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #667eea; font-weight: 600; padding: 10px; background: #e3f2fd; border-radius: 5px;">
                        🌐 View Translation
                    </summary>
                    <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; line-height: 1.6; white-space: pre-wrap;">
                        ${escapeHtml(summary.translatedTranscript)}
                    </div>
                </details>
            ` : ''}
        </div>
    `).join('');
}

async function deleteMeetingSummary(id) {
    const API_MEETINGS_URL = '/api/meetings';
    
    if (!confirm('Delete this meeting summary? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_MEETINGS_URL}/summaries/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Summary deleted successfully', 'success');
            loadMeetingSummaries();
        }
    } catch (error) {
        console.error('Error deleting summary:', error);
        showNotification('Failed to delete summary', 'error');
    }
}

function formatSummary(summary) {
    if (!summary) return '';
    
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