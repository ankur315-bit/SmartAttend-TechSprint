const mongoose = require('mongoose');

const wifiSessionSchema = new mongoose.Schema({
    attendanceSession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        required: false // Make optional for geofence-only entries
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Hotspot configuration
    hotspot: {
        ssid: {
            type: String,
            required: true
        },
        bssid: String, // MAC address
        password: String,
        ipAddress: String, // Teacher's IP when hotspot is created
        gatewayIP: String
    },
    // Connected students
    connectedDevices: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        ipAddress: String,
        macAddress: String,
        deviceInfo: String,
        connectedAt: Date,
        isVerified: {
            type: Boolean,
            default: false
        }
    }],
    // Geofence settings
    geofence: {
        centerLatitude: Number,
        centerLongitude: Number,
        radius: {
            type: Number,
            default: 50 // meters
        }
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'inactive'
    },
    startedAt: Date,
    endedAt: Date
}, { timestamps: true });

wifiSessionSchema.index({ status: 1 });
wifiSessionSchema.index({ 'hotspot.ssid': 1 });

module.exports = mongoose.model('WifiSession', wifiSessionSchema);
