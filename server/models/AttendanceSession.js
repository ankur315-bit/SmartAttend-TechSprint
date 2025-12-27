const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    timetable: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timetable',
        required: true
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'active', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    // WiFi-based geofencing
    wifiConfig: {
        ssid: String,           // Teacher's hotspot name
        bssid: String,          // MAC address of hotspot
        allowedIPs: [String],   // IP addresses of connected students
        geofenceRadius: {
            type: Number,
            default: 50 // meters
        }
    },
    // Location data
    location: {
        latitude: Number,
        longitude: Number,
        room: String
    },
    startedAt: Date,
    endedAt: Date,
    // Statistics
    totalStudents: {
        type: Number,
        default: 0
    },
    presentCount: {
        type: Number,
        default: 0
    },
    absentCount: {
        type: Number,
        default: 0
    },
    lateCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Index for efficient queries
attendanceSessionSchema.index({ date: 1, faculty: 1 });
attendanceSessionSchema.index({ status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
