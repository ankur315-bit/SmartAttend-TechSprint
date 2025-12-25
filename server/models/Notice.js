const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['general', 'urgent', 'academic', 'event', 'email'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'normal', 'urgent'],
        default: 'medium'
    },
    targetAudience: {
        roles: [{
            type: String,
            enum: ['all', 'student', 'faculty']
        }],
        branches: [String],
        semesters: [Number]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attachments: [{
        filename: String,
        path: String,
        mimetype: String
    }],
    expiresAt: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: Date
    }]
}, { timestamps: true });

noticeSchema.index({ createdAt: -1 });
noticeSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
