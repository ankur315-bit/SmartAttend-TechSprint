const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const Timetable = require('../models/Timetable');
const { protect, isAdmin } = require('../middleware/auth');

// @route   GET /api/batches
// @desc    Get all batches
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { semester, branch, section, isActive } = req.query;

        const query = {};
        if (semester) query.semester = parseInt(semester);
        if (branch) query.branch = branch;
        if (section) query.section = section;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const batches = await Batch.find(query)
            .sort({ semester: 1, branch: 1, section: 1 })
            .populate('createdBy', 'name');

        res.json({
            success: true,
            count: batches.length,
            batches
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching batches',
            error: error.message
        });
    }
});

// @route   POST /api/batches
// @desc    Create a new batch
// @access  Private/Admin
router.post('/', protect, isAdmin, async (req, res) => {
    try {
        const { name, semester, branch, section, description } = req.body;

        // Check if batch already exists
        const existingBatch = await Batch.findOne({ name });
        if (existingBatch) {
            return res.status(400).json({
                success: false,
                message: 'A batch with this name already exists'
            });
        }

        const batch = await Batch.create({
            name,
            semester,
            branch,
            section,
            description,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'Batch created successfully',
            batch
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating batch',
            error: error.message
        });
    }
});

// @route   GET /api/batches/:id
// @desc    Get a single batch with its timetable
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id)
            .populate('createdBy', 'name');

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Get timetable for this batch
        const timetable = await Timetable.find({
            batch: batch.name,
            isActive: true
        })
            .populate('subject', 'name code')
            .populate('faculty', 'name')
            .sort({ day: 1, startTime: 1 });

        res.json({
            success: true,
            batch,
            timetable
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching batch',
            error: error.message
        });
    }
});

// @route   PUT /api/batches/:id
// @desc    Update a batch
// @access  Private/Admin
router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        const { name, semester, branch, section, description, studentCount, isActive } = req.body;

        const batch = await Batch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Update fields
        if (name) batch.name = name;
        if (semester) batch.semester = semester;
        if (branch) batch.branch = branch;
        if (section) batch.section = section;
        if (description !== undefined) batch.description = description;
        if (studentCount !== undefined) batch.studentCount = studentCount;
        if (isActive !== undefined) batch.isActive = isActive;

        await batch.save();

        res.json({
            success: true,
            message: 'Batch updated successfully',
            batch
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating batch',
            error: error.message
        });
    }
});

// @route   DELETE /api/batches/:id
// @desc    Delete a batch
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Check if batch has timetable entries
        const timetableCount = await Timetable.countDocuments({ batch: batch.name });
        if (timetableCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete batch. It has ${timetableCount} timetable entries. Please delete or reassign them first.`
            });
        }

        await batch.deleteOne();

        res.json({
            success: true,
            message: 'Batch deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting batch',
            error: error.message
        });
    }
});

// @route   GET /api/batches/:id/stats
// @desc    Get batch statistics
// @access  Private
router.get('/:id/stats', protect, async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        const timetableCount = await Timetable.countDocuments({
            batch: batch.name,
            isActive: true
        });

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const scheduleByDay = {};

        for (const day of days) {
            scheduleByDay[day] = await Timetable.countDocuments({
                batch: batch.name,
                day,
                isActive: true
            });
        }

        res.json({
            success: true,
            stats: {
                batchName: batch.name,
                totalClasses: timetableCount,
                studentCount: batch.studentCount,
                scheduleByDay
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching batch stats',
            error: error.message
        });
    }
});

module.exports = router;
