// Socket.IO handler for real-time updates
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/constants');

module.exports = (io) => {
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.id;
            socket.userRole = decoded.role;
            next();
        } catch (error) {
            return next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.userId}`);

        // Join user-specific room
        socket.join(`user_${socket.userId}`);

        // Faculty joins their session room
        socket.on('joinSession', (sessionId) => {
            socket.join(`session_${sessionId}`);
            console.log(`👨‍🏫 Faculty joined session: ${sessionId}`);
        });

        // Student joins session room for updates
        socket.on('joinStudentSession', (sessionId) => {
            socket.join(`session_${sessionId}`);
            console.log(`👨‍🎓 Student joined session: ${sessionId}`);
        });

        // Faculty starts WiFi hotspot - notify relevant students
        socket.on('hotspotStarted', (data) => {
            io.emit('newAttendanceSession', {
                sessionId: data.sessionId,
                wifiSSID: data.ssid,
                facultyName: data.facultyName,
                subjectName: data.subjectName,
                room: data.room
            });
        });

        // Student connects to WiFi
        socket.on('studentConnected', (data) => {
            io.to(`session_${data.sessionId}`).emit('studentJoinedWifi', {
                studentId: data.studentId,
                studentName: data.studentName,
                rollNumber: data.rollNumber,
                ipAddress: data.ipAddress,
                timestamp: new Date()
            });
        });

        // Student location verified
        socket.on('locationVerified', (data) => {
            io.to(`session_${data.sessionId}`).emit('studentLocationVerified', {
                studentId: data.studentId,
                studentName: data.studentName,
                distance: data.distance,
                timestamp: new Date()
            });
        });

        // Face verification started
        socket.on('faceVerificationStarted', (data) => {
            io.to(`session_${data.sessionId}`).emit('studentVerifyingFace', {
                studentId: data.studentId,
                studentName: data.studentName
            });
        });

        // Attendance marked
        socket.on('attendanceMarked', (data) => {
            io.to(`session_${data.sessionId}`).emit('attendanceUpdate', {
                studentId: data.studentId,
                studentName: data.studentName,
                rollNumber: data.rollNumber,
                status: data.status,
                markedAt: new Date()
            });

            // Notify the student
            io.to(`user_${data.studentId}`).emit('attendanceConfirmed', {
                status: data.status,
                subjectName: data.subjectName
            });
        });

        // Faculty ends session
        socket.on('sessionEnded', (data) => {
            io.to(`session_${data.sessionId}`).emit('sessionClosed', {
                message: 'Attendance session has ended',
                statistics: data.statistics
            });
        });

        // Manual override by faculty
        socket.on('manualOverride', (data) => {
            io.to(`user_${data.studentId}`).emit('attendanceOverridden', {
                newStatus: data.newStatus,
                reason: data.reason,
                subjectName: data.subjectName
            });
        });

        // New notice
        socket.on('noticePublished', (data) => {
            io.emit('newNotice', {
                id: data.noticeId,
                title: data.title,
                type: data.type,
                priority: data.priority
            });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`❌ User disconnected: ${socket.userId}`);
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    return io;
};
