const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    name: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        required: true,
        min: 1
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    branch: {
        type: String,
        required: true,
        enum: ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil', 'ALL']
    },
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['theory', 'lab', 'tutorial'],
        default: 'theory'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
