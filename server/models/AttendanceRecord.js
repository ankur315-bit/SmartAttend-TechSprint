const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        required: true
    },
    student: {
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
        enum: ['present', 'absent', 'late', 'excused'],
        default: 'absent'
    },
    // Verification data
    verificationMethod: {
        type: String,
        enum: ['wifi_face', 'manual', 'qr_code'],
        default: 'wifi_face'
    },
    // WiFi verification
    wifiVerification: {
        connected: {
            type: Boolean,
            default: false
        },
        ipAddress: String,
        ssid: String,
        verifiedAt: Date
    },
    // Geolocation verification
    locationVerification: {
        verified: {
            type: Boolean,
            default: false
        },
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        distanceFromClass: Number,
        verifiedAt: Date
    },
    // Face verification
    faceVerification: {
        verified: {
            type: Boolean,
            default: false
        },
        confidence: Number,
        capturedImage: String,
        verifiedAt: Date
    },
    // Manual override by faculty
    manualOverride: {
        applied: {
            type: Boolean,
            default: false
        },
        reason: String,
        overriddenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        overriddenAt: Date
    },
    markedAt: Date,
    remarks: String
}, { timestamps: true });

// Compound index to prevent duplicate attendance
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });
attendanceRecordSchema.index({ student: 1, date: 1 });
attendanceRecordSchema.index({ subject: 1, date: 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
