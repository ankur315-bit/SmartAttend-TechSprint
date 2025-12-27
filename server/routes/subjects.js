const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const { protect, isAdmin } = require('../middleware/auth');

// @route   GET /api/subjects
// @desc    Get all subjects
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { semester, branch, facultyId } = req.query;

        const query = { isActive: true };

        if (semester) query.semester = parseInt(semester);
        if (branch) query.branch = { $in: [branch, 'ALL'] };
        if (facultyId) query.faculty = facultyId;

        const subjects = await Subject.find(query)
            .populate('faculty', 'name email')
            .sort({ semester: 1, name: 1 });

        res.json({
            success: true,
            count: subjects.length,
            subjects
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching subjects',
            error: error.message
        });
    }
});

// @route   GET /api/subjects/:id
// @desc    Get single subject
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id)
            .populate('faculty', 'name email department');

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            subject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching subject',
            error: error.message
        });
    }
});

// @route   POST /api/subjects
// @desc    Create subject
// @access  Private/Admin
router.post('/', protect, isAdmin, async (req, res) => {
    try {
        let { code, name, credits, semester, branch, faculty, type, department } = req.body;

        // Generate code if not provided
        if (!code) {
            code = name.split(' ').map(w => w[0]).join('').toUpperCase() + Math.floor(Math.random() * 1000);
        }

        // Set defaults
        credits = credits || 3;
        semester = semester || 1;
        branch = branch || department || 'CSE';
        type = type || 'theory';

        const existingSubject = await Subject.findOne({ code: code.toUpperCase() });
        if (existingSubject) {
            // Update existing subject instead of failing
            existingSubject.name = name;
            existingSubject.faculty = faculty;
            existingSubject.credits = credits;
            existingSubject.semester = semester;
            existingSubject.branch = branch;
            existingSubject.type = type;
            await existingSubject.save();

            return res.json({
                success: true,
                message: 'Subject updated successfully',
                subject: existingSubject
            });
        }

        const subject = await Subject.create({
            code: code.toUpperCase(),
            name,
            credits,
            semester,
            branch,
            faculty,
            type
        });

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            subject
        });
    } catch (error) {
        console.error('Subject creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating subject',
            error: error.message
        });
    }
});

// @route   PUT /api/subjects/:id
// @desc    Update subject
// @access  Private/Admin
router.put('/:id', protect, isAdmin, async (req, res) => {
    try {
        const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            message: 'Subject updated successfully',
            subject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating subject',
            error: error.message
        });
    }
});

// @route   PUT /api/subjects/:id/assign-faculty
// @desc    Assign faculty to subject
// @access  Private/Admin
router.put('/:id/assign-faculty', protect, isAdmin, async (req, res) => {
    try {
        const { facultyId } = req.body;

        const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            { faculty: facultyId },
            { new: true }
        ).populate('faculty', 'name email');

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            message: 'Faculty assigned successfully',
            subject
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning faculty',
            error: error.message
        });
    }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete subject (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        subject.isActive = false;
        await subject.save();

        res.json({
            success: true,
            message: 'Subject deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting subject',
            error: error.message
        });
    }
});

module.exports = router;
