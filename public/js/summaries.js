// load meeting summaries
async function loadMeetingSummaries() {
    const API_MEETINGS_URL = '/api/meetings';
    const summariesList = document.getElementById('summariesList');
    const emptyState = document.getElementById('summariesEmptyState');
    
    if (!summariesList) {
        console.error('summariesList element not found');
        return;
    }
    
    try {
        console.log('Loading meeting summaries...');
        const response = await fetch(`${API_MEETINGS_URL}/summaries`);
        const data = await response.json();
        
        console.log('Summaries response:', data);
        
        if (data.success) {
            renderMeetingSummaries(data.data);
        } else {
            console.error('Failed to load summaries:', data.error);
            showNotification('Failed to load summaries', 'error');
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
    
    if (!container) {
        console.error('summariesList container not found');
        return;
    }
    
    console.log(`Rendering ${summaries.length} summaries`);
    
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
                <button class="btn btn-danger btn-small" onclick="deleteMeetingSummary('${summary._id}')" title="Delete summary">
                    Delete
                </button>
            </div>
            <div class="summary-meta">
                <span> Meeting: ${new Date(summary.meetingDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</span>
                <span> Generated: ${new Date(summary.generatedAt).toLocaleString('en-US', { 
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
                    <summary style="cursor: pointer; color: #667eea; font-weight: 600; padding: 10px; background: black; border-radius: 5px; width: max-content;">
                        View Full Transcript
                    </summary>
                    <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; line-height: 1.6; white-space: pre-wrap;">
                        ${escapeHtml(summary.transcript)}
                    </div>
                </details>
            ` : ''}
            ${summary.translatedTranscript ? `
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #667eea; font-weight: 600; padding: 10px; background: black; border-radius: 5px; width: max-content;">
                        View Translation
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
    
    showConfirmModal('Delete this meeting summary?', async () => {
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
    });
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ summaries.js loaded successfully');