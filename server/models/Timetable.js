const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: false // Make optional for manual entry
    },
    subjectName: {
        type: String,
        required: false // Manual subject name entry
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Make optional
    },
    semester: {
        type: Number,
        default: 1
    },
    branch: {
        type: String,
        default: 'CSE'
    },
    section: {
        type: String,
        default: 'A'
    },
    batch: {
        type: String,
        default: 'Default' // Batch/Section like CSE-A, ECE-B
    },
    classSection: {
        type: String,
        default: 'Default' // Alias for batch
    },
    startTime: {
        type: String,
        required: true // Format: "09:00"
    },
    endTime: {
        type: String,
        required: true // Format: "10:00"
    },
    room: {
        type: String,
        default: 'TBA'
    },
    type: {
        type: String,
        enum: ['lecture', 'lab', 'tutorial'],
        default: 'lecture'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Remove unique constraints that might cause issues
timetableSchema.index({ day: 1, startTime: 1, room: 1 })
timetableSchema.index({ day: 1, startTime: 1, faculty: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
