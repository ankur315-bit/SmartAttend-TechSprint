// ===== Smart Attendance System - Utility Functions =====

const Utils = {
    // Format date
    formatDate(date, format = 'full') {
        const d = new Date(date);
        const options = {
            full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        return d.toLocaleDateString('en-US', options[format] || options.full);
    },

    // Time ago
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 4000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-custom ${type}`;
        toast.innerHTML = `
            <i class="bi ${this.getToastIcon(type)} fs-5"></i>
            <span>${message}</span>
            <button class="btn-close btn-close-sm ms-auto" onclick="this.parentElement.remove()"></button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getToastIcon(type) {
        const icons = {
            success: 'bi-check-circle-fill text-success',
            error: 'bi-x-circle-fill text-danger',
            warning: 'bi-exclamation-triangle-fill text-warning',
            info: 'bi-info-circle-fill text-info'
        };
        return icons[type] || icons.info;
    },

    // Show loading spinner
    showLoading(element, text = 'Loading...') {
        const original = element.innerHTML;
        element.disabled = true;
        element.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
        return () => {
            element.disabled = false;
            element.innerHTML = original;
        };
    },

    // Show modal
    showModal(title, content, options = {}) {
        const modalId = 'dynamic-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered ${options.size || ''}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body"></div>
                        <div class="modal-footer"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-body').innerHTML = content;

        const footer = modal.querySelector('.modal-footer');
        if (options.buttons) {
            footer.innerHTML = options.buttons.map(btn =>
                `<button type="button" class="btn ${btn.class || 'btn-secondary'}" ${btn.dismiss ? 'data-bs-dismiss="modal"' : ''} onclick="${btn.onclick || ''}">${btn.text}</button>`
            ).join('');
            footer.style.display = '';
        } else {
            footer.style.display = 'none';
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        return bsModal;
    },

    // Confirm dialog
    confirm(message, onConfirm, onCancel) {
        this.showModal('Confirm', `<p>${message}</p>`, {
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', dismiss: true, onclick: onCancel ? `(${onCancel.toString()})()` : '' },
                { text: 'Confirm', class: 'btn-primary', dismiss: true, onclick: `(${onConfirm.toString()})()` }
            ]
        });
    },

    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Calculate attendance percentage
    calculatePercentage(present, total) {
        if (total === 0) return 0;
        return Math.round((present / total) * 100);
    },

    // Get attendance status color
    getStatusColor(percentage) {
        if (percentage >= 75) return 'success';
        if (percentage >= 60) return 'warning';
        return 'danger';
    },

    // Get status badge HTML
    getStatusBadge(status) {
        const badges = {
            present: '<span class="badge-status badge-present">Present</span>',
            absent: '<span class="badge-status badge-absent">Absent</span>',
            late: '<span class="badge-status badge-late">Late</span>',
            excused: '<span class="badge-status badge-excused">Excused</span>'
        };
        return badges[status] || badges.absent;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Local storage helpers
    storage: {
        get: (key) => {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch {
                return localStorage.getItem(key);
            }
        },
        set: (key, value) => {
            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
        },
        remove: (key) => localStorage.removeItem(key)
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy', 'error');
        }
    },

    // Download as CSV
    downloadCSV(data, filename) {
        const csv = data.map(row => Object.values(row).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Get current day name
    getCurrentDay() {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[new Date().getDay()];
    },

    // Check if current time is between two times
    isTimeBetween(startTime, endTime) {
        const now = new Date();
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
};

// Export
window.Utils = Utils;

// Global logout handler
function handleLogout(event) {
    if (event) event.preventDefault();

    // Clear all auth data
    TokenService.removeToken();
    localStorage.removeItem('user');
    localStorage.removeItem('facultyEmail');
    localStorage.removeItem('studentEmail');

    // Redirect to home page
    window.location.href = '/';
}
