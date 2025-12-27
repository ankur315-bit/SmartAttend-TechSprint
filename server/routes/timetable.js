const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const { protect, authorize, isAdmin } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// @route   GET /api/timetable
// @desc    Get timetable for a class
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { semester, branch, section, day, facultyId, batch } = req.query;

        const query = { isActive: true };

        if (semester) query.semester = parseInt(semester);
        if (branch) query.branch = branch;
        if (section) query.section = section;
        if (batch) query.batch = batch;
        if (day) query.day = day.toLowerCase();
        if (facultyId) query.faculty = facultyId;

        // For students, use their profile data
        if (req.user.role === ROLES.STUDENT) {
            query.semester = req.user.semester;
            query.branch = req.user.branch;
            query.section = req.user.section || 'A';
            if (req.user.batch) {
                query.batch = req.user.batch;
            }
        }

        // For faculty, show only their classes
        if (req.user.role === ROLES.FACULTY) {
            query.faculty = req.user.id;
        }

        const timetable = await Timetable.find(query)
            .populate('subject', 'name code type credits')
            .populate('faculty', 'name email')
            .sort({ day: 1, startTime: 1 });

        res.json({
            success: true,
            count: timetable.length,
            timetable: timetable
        });
    } catch (error) {
        console.error('Timetable fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timetable',
            error: error.message
        });
    }
});

// @route   GET /api/timetable/today
// @desc    Get today's schedule
// @access  Private
router.get('/today', protect, async (req, res) => {
    try {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];

        if (today === 'sunday') {
            return res.json({
                success: true,
                message: 'No classes on Sunday',
                schedule: []
            });
        }

        const query = { day: today, isActive: true };

        if (req.user.role === ROLES.STUDENT) {
            query.semester = req.user.semester;
            query.branch = req.user.branch;
            query.section = req.user.section || 'A';
            if (req.user.batch) {
                query.batch = req.user.batch;
            }
        } else if (req.user.role === ROLES.FACULTY) {
            query.faculty = req.user.id;
        }

        const schedule = await Timetable.find(query)
            .populate('subject', 'name code type')
            .populate('faculty', 'name')
            .sort({ startTime: 1 });

        res.json({
            success: true,
            day: today,
            schedule
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching today\'s schedule',
            error: error.message
        });
    }
});

// @route   POST /api/timetable
// @desc    Create timetable entry
// @access  Private/Admin
router.post('/', protect, isAdmin, async (req, res) => {
    try {
        const { day, subject, subjectName, faculty, semester, branch, section, batch, classSection, startTime, endTime, room, type, teacher } = req.body;

        // Check for conflicts
        const conflict = await Timetable.findOne({
            day: day?.toLowerCase(),
            startTime,
            $or: [
                { room, isActive: true },
                { faculty: faculty || teacher, isActive: true }
            ]
        });

        if (conflict) {
            return res.status(400).json({
                success: false,
                message: 'Time slot conflict detected. Room or faculty already occupied.'
            });
        }

        const entry = await Timetable.create({
            day: day?.toLowerCase() || 'monday',
            subject: subject,
            subjectName: subjectName || subject,
            faculty: faculty || teacher,
            semester: semester || 1,
            branch: branch || 'CSE',
            section: section || 'A',
            batch: batch || classSection,
            classSection: batch || classSection,
            startTime,
            endTime,
            room,
            type: type || 'lecture'
        });

        await entry.populate('subject', 'name code');
        await entry.populate('faculty', 'name');

        res.status(201).json({
            success: true,
            message: 'Timetable entry created',
            entry
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating timetable entry',
            error: error.message
        });
    }
});

// @route   GET /api/timetable/:id
// @desc    Get single timetable entry
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const entry = await Timetable.findById(req.params.id)
            .populate('subject', 'name code')
            .populate('faculty', 'name email');

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found'
            });
        }

        res.json({
            success: true,
            entry
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching timetable entry',
            error: error.message
        });
    }
});

// @route   PUT /api/timetable/:id
// @desc    Update timetable entry
// @access  Private/Admin
router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        const { day, subject, subjectName, faculty, teacher, semester, branch, section, batch, classSection, startTime, endTime, room, type } = req.body;

        const entry = await Timetable.findById(req.params.id);

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found'
            });
        }

        // Update fields
        if (day) entry.day = day.toLowerCase();
        if (subject) entry.subject = subject;
        if (subjectName) entry.subjectName = subjectName;
        if (faculty || teacher) entry.faculty = faculty || teacher;
        if (semester) entry.semester = semester;
        if (branch) entry.branch = branch;
        if (section) entry.section = section;
        if (batch) entry.batch = batch;
        if (classSection) entry.classSection = classSection;
        if (startTime) entry.startTime = startTime;
        if (endTime) entry.endTime = endTime;
        if (room) entry.room = room;
        if (type) entry.type = type;

        await entry.save();
        await entry.populate('subject', 'name code');
        await entry.populate('faculty', 'name');

        res.json({
            success: true,
            message: 'Timetable entry updated',
            entry
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating timetable entry',
            error: error.message
        });
    }
});

// @route   DELETE /api/timetable/:id
// @desc    Delete timetable entry
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const entry = await Timetable.findById(req.params.id);

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found'
            });
        }

        await entry.deleteOne();

        res.json({
            success: true,
            message: 'Timetable entry deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting timetable entry',
            error: error.message
        });
    }
});

// @route   POST /api/timetable/bulk
// @desc    Create multiple timetable entries
// @access  Private/Admin
router.post('/bulk', protect, isAdmin, async (req, res) => {
    try {
        const { entries } = req.body;

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of timetable entries'
            });
        }

        const formattedEntries = entries.map(e => ({
            ...e,
            day: e.day.toLowerCase(),
            section: e.section || 'A',
            type: e.type || 'lecture',
            isActive: true
        }));

        const created = await Timetable.insertMany(formattedEntries, { ordered: false });

        res.status(201).json({
            success: true,
            message: `${created.length} timetable entries created`,
            entries: created
        });
    } catch (error) {
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Some entries have conflicts',
                error: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error creating timetable entries',
            error: error.message
        });
    }
});

// @route   PUT /api/timetable/:id
// @desc    Update timetable entry
// @access  Private/Admin
router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        const entry = await Timetable.findByIdAndUpdate(
            req.params.id,
            { ...req.body, day: req.body.day?.toLowerCase() },
            { new: true, runValidators: true }
        )
            .populate('subject', 'name code')
            .populate('faculty', 'name');

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found'
            });
        }

        res.json({
            success: true,
            message: 'Timetable entry updated',
            entry
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating timetable entry',
            error: error.message
        });
    }
});

// @route   DELETE /api/timetable/:id
// @desc    Delete timetable entry
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const entry = await Timetable.findById(req.params.id);

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found'
            });
        }

        // Soft delete
        entry.isActive = false;
        await entry.save();

        res.json({
            success: true,
            message: 'Timetable entry removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting timetable entry',
            error: error.message
        });
    }
});

// @route   POST /api/timetable/reschedule
// @desc    Reschedule a class
// @access  Private/Admin
router.post('/reschedule', protect, isAdmin, async (req, res) => {
    try {
        const { originalId, newDay, newStartTime, newEndTime, newRoom, reason } = req.body;

        const original = await Timetable.findById(originalId);

        if (!original) {
            return res.status(404).json({
                success: false,
                message: 'Original timetable entry not found'
            });
        }

        // Check for conflicts at new time
        const conflict = await Timetable.findOne({
            day: newDay.toLowerCase(),
            startTime: newStartTime,
            $or: [
                { room: newRoom },
                { faculty: original.faculty }
            ],
            isActive: true,
            _id: { $ne: originalId }
        });

        if (conflict) {
            return res.status(400).json({
                success: false,
                message: 'New time slot has conflicts'
            });
        }

        // Update the entry
        original.day = newDay.toLowerCase();
        original.startTime = newStartTime;
        original.endTime = newEndTime;
        original.room = newRoom;
        await original.save();

        res.json({
            success: true,
            message: 'Class rescheduled successfully',
            entry: original
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error rescheduling class',
            error: error.message
        });
    }
});

module.exports = router;
