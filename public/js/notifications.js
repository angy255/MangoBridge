// show notification at center of screen
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 2000;
        min-width: 300px;
        max-width: 500px;
        text-align: center;
        font-size: 16px;
        font-weight: 600;
        animation: fadeInScale 0.3s ease;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOutScale 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// confirmation modal to replace confirm()
function showConfirmModal(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2001;
        animation: fadeIn 0.3s ease;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
        animation: slideInDown 0.3s ease;
    `;
    
    content.innerHTML = `
        <p style="margin-bottom: 25px; font-size: 16px; color: #333; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="confirmYes" class="btn btn-danger" style="padding: 10px 25px;">Yes</button>
            <button id="confirmNo" class="btn btn-secondary" style="padding: 10px 25px;">Cancel</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    
    document.getElementById('confirmYes').addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });
    
    document.getElementById('confirmNo').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }
    
    @keyframes fadeOutScale {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);