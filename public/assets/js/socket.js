// ===== Smart Attendance System - Socket Service =====

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.listeners = new Map();
    }

    connect() {
        const token = API.Token.get();
        if (!token) {
            console.warn('No token found, cannot connect to socket');
            return;
        }

        this.socket = io({
            auth: { token }
        });

        this.socket.on('connect', () => {
            console.log('🔌 Socket connected');
            this.connected = true;
            this.emit('socketConnected');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            this.connected = false;
            this.emit('socketDisconnected');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.emit('socketError', error);
        });

        // Listen for common events
        this.setupCommonListeners();
    }

    setupCommonListeners() {
        // New attendance session available
        this.socket.on('newAttendanceSession', (data) => {
            this.emit('newAttendanceSession', data);
            Utils.showToast(`New attendance session: ${data.subjectName}`, 'info');
        });

        // Student connected to WiFi
        this.socket.on('studentJoinedWifi', (data) => {
            this.emit('studentJoinedWifi', data);
        });

        // Student location verified
        this.socket.on('studentLocationVerified', (data) => {
            this.emit('studentLocationVerified', data);
        });

        // Student verifying face
        this.socket.on('studentVerifyingFace', (data) => {
            this.emit('studentVerifyingFace', data);
        });

        // Attendance update
        this.socket.on('attendanceUpdate', (data) => {
            this.emit('attendanceUpdate', data);
        });

        // Session closed
        this.socket.on('sessionClosed', (data) => {
            this.emit('sessionClosed', data);
            Utils.showToast('Attendance session has ended', 'info');
        });

        // Attendance confirmed (for students)
        this.socket.on('attendanceConfirmed', (data) => {
            this.emit('attendanceConfirmed', data);
            Utils.showToast(`Attendance marked as ${data.status}!`, 'success');
        });

        // Attendance overridden
        this.socket.on('attendanceOverridden', (data) => {
            this.emit('attendanceOverridden', data);
            Utils.showToast(`Attendance updated to ${data.newStatus}`, 'info');
        });

        // New notice
        this.socket.on('newNotice', (data) => {
            this.emit('newNotice', data);
            Utils.showToast(`New Notice: ${data.title}`, 'info');
        });
    }

    joinSession(sessionId) {
        if (this.socket) {
            this.socket.emit('joinSession', sessionId);
        }
    }

    joinStudentSession(sessionId) {
        if (this.socket) {
            this.socket.emit('joinStudentSession', sessionId);
        }
    }

    emitHotspotStarted(data) {
        if (this.socket) {
            this.socket.emit('hotspotStarted', data);
        }
    }

    emitStudentConnected(data) {
        if (this.socket) {
            this.socket.emit('studentConnected', data);
        }
    }

    emitLocationVerified(data) {
        if (this.socket) {
            this.socket.emit('locationVerified', data);
        }
    }

    emitFaceVerificationStarted(data) {
        if (this.socket) {
            this.socket.emit('faceVerificationStarted', data);
        }
    }

    emitAttendanceMarked(data) {
        if (this.socket) {
            this.socket.emit('attendanceMarked', data);
        }
    }

    emitSessionEnded(data) {
        if (this.socket) {
            this.socket.emit('sessionEnded', data);
        }
    }

    // Event emitter pattern
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }
}

// Create global socket instance
window.socketService = new SocketService();
