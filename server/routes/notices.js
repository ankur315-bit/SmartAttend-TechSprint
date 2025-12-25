const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const { protect, authorize, isAdmin } = require('../middleware/auth');
const { uploadNotice } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// @route   GET /api/notices
// @desc    Get notices for user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { type, priority, page = 1, limit = 10 } = req.query;

        const query = {
            isActive: true,
            $or: [
                { expiresAt: { $gt: new Date() } },
                { expiresAt: null }
            ]
        };

        // Filter by target audience
        query.$and = [
            {
                $or: [
                    { 'targetAudience.roles': 'all' },
                    { 'targetAudience.roles': req.user.role }
                ]
            }
        ];

        // Additional filters for students
        if (req.user.role === ROLES.STUDENT) {
            query.$and.push({
                $or: [
                    { 'targetAudience.branches': { $size: 0 } },
                    { 'targetAudience.branches': req.user.branch }
                ]
            });
            query.$and.push({
                $or: [
                    { 'targetAudience.semesters': { $size: 0 } },
                    { 'targetAudience.semesters': req.user.semester }
                ]
            });
        }

        if (type) query.type = type;
        if (priority) query.priority = priority;

        const notices = await Notice.find(query)
            .populate('createdBy', 'name role')
            .sort({ priority: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notice.countDocuments(query);

        // Mark unread count
        const unreadCount = notices.filter(n =>
            !n.readBy.some(r => r.user.toString() === req.user.id)
        ).length;

        res.json({
            success: true,
            count: notices.length,
            total,
            pages: Math.ceil(total / limit),
            unreadCount,
            notices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notices',
            error: error.message
        });
    }
});

// @route   GET /api/notices/:id
// @desc    Get single notice
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id)
            .populate('createdBy', 'name role');

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        // Mark as read
        if (!notice.readBy.some(r => r.user.toString() === req.user.id)) {
            notice.readBy.push({
                user: req.user.id,
                readAt: new Date()
            });
            await notice.save();
        }

        res.json({
            success: true,
            notice
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notice',
            error: error.message
        });
    }
});

// @route   POST /api/notices
// @desc    Create notice
// @access  Private/Admin/Faculty
router.post('/', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), uploadNotice.array('attachments', 5), async (req, res) => {
    try {
        let { title, content, type, priority, targetRoles, targetBranches, targetSemesters, expiresAt, targetAudience } = req.body;

        // Handle both direct targetAudience and separate fields
        let parsedTargetAudience;
        if (targetAudience && typeof targetAudience === 'string') {
            try {
                parsedTargetAudience = JSON.parse(targetAudience);
            } catch (e) {
                parsedTargetAudience = null;
            }
        }

        // Parse roles - handle both old and new format
        let roles = ['all'];
        if (parsedTargetAudience && parsedTargetAudience.roles) {
            roles = parsedTargetAudience.roles;
        } else if (targetRoles) {
            try {
                roles = typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles;
            } catch (e) {
                // Handle simple string values like "All", "Faculty", "Students"
                const roleMap = { 'All': ['all'], 'Faculty': ['faculty'], 'Students': ['student'], 'all': ['all'] };
                roles = roleMap[targetRoles] || ['all'];
            }
        }

        const notice = await Notice.create({
            title,
            content,
            type: type || 'general',
            priority: (priority || 'medium').toLowerCase(),
            targetAudience: {
                roles: roles,
                branches: targetBranches ? (typeof targetBranches === 'string' ? JSON.parse(targetBranches) : targetBranches) : [],
                semesters: targetSemesters ? (typeof targetSemesters === 'string' ? JSON.parse(targetSemesters) : targetSemesters) : []
            },
            createdBy: req.user.id,
            attachments: req.files ? req.files.map(f => ({
                filename: f.originalname,
                path: `/uploads/notices/${f.filename}`,
                mimetype: f.mimetype
            })) : [],
            expiresAt: expiresAt || null
        });

        await notice.populate('createdBy', 'name role');

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('newNotice', {
                id: notice._id,
                title: notice.title,
                type: notice.type,
                priority: notice.priority
            });
        }

        // Send email notifications to target users
        if (global.EmailService) {
            const User = require('../models/User');
            let userQuery = { isActive: true };

            if (!roles.includes('all')) {
                userQuery.role = { $in: roles };
            }

            const users = await User.find(userQuery).select('email name');
            if (users.length > 0) {
                global.EmailService.sendNoticeNotification(users, notice)
                    .catch(err => console.error('Notice email failed:', err.message));
            }
        }

        res.status(201).json({
            success: true,
            message: 'Notice created successfully',
            notice
        });
    } catch (error) {
        console.error('Notice creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating notice',
            error: error.message
        });
    }
});

// @route   PUT /api/notices/:id
// @desc    Update notice
// @access  Private/Admin
router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        const notice = await Notice.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name role');

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        res.json({
            success: true,
            message: 'Notice updated successfully',
            notice
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating notice',
            error: error.message
        });
    }
});

// @route   DELETE /api/notices/:id
// @desc    Delete notice
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        notice.isActive = false;
        await notice.save();

        res.json({
            success: true,
            message: 'Notice deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting notice',
            error: error.message
        });
    }
});

// @route   DELETE /api/notices
// @desc    Clear all notices for user (mark as read) or delete all (admin)
// @access  Private
router.delete('/', protect, async (req, res) => {
    try {
        if (req.user.role === ROLES.ADMIN) {
            // Admin can delete all notices
            await Notice.deleteMany({});
            res.json({
                success: true,
                message: 'All notices cleared'
            });
        } else {
            // Regular users can only mark as read
            const notices = await Notice.find({
                isActive: true,
                'targetAudience.roles': { $in: ['all', req.user.role] }
            });

            for (const notice of notices) {
                if (!notice.readBy.some(r => r.user.toString() === req.user.id)) {
                    notice.readBy.push({
                        user: req.user.id,
                        readAt: new Date()
                    });
                    await notice.save();
                }
            }

            res.json({
                success: true,
                message: 'All notifications marked as read'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error clearing notices',
            error: error.message
        });
    }
});

module.exports = router;
