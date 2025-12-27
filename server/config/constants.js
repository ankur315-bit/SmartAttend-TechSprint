module.exports = {
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'smart_attendance_secret_key_2024',
    JWT_EXPIRE: '7d',

    // Geofencing Configuration
    DEFAULT_GEOFENCE_RADIUS: 50, // meters
    WIFI_CHECK_INTERVAL: 5000, // milliseconds

    // Face Verification
    FACE_MATCH_THRESHOLD: 0.6, // 60% similarity required

    // Attendance Session
    SESSION_DURATION: 60, // minutes
    LATE_THRESHOLD: 15, // minutes after session start

    // User Roles
    ROLES: {
        ADMIN: 'admin',
        FACULTY: 'faculty',
        STUDENT: 'student'
    },

    // Attendance Status
    ATTENDANCE_STATUS: {
        PRESENT: 'present',
        ABSENT: 'absent',
        LATE: 'late',
        EXCUSED: 'excused'
    },

    // Session Status
    SESSION_STATUS: {
        SCHEDULED: 'scheduled',
        ACTIVE: 'active',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    }
};
