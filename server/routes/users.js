const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize, isAdmin } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', protect, isAdmin, async (req, res) => {
    try {
        const { role, branch, semester, search, page = 1, limit = 20 } = req.query;

        const query = {};

        if (role) query.role = role;
        if (branch) query.branch = branch;
        if (semester) query.semester = parseInt(semester);
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { rollNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password -faceEncoding')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            count: users.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
});

// @route   GET /api/users/students
// @desc    Get all students (Faculty & Admin)
// @access  Private/Faculty
router.get('/students', protect, authorize(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
    try {
        const { branch, semester, section } = req.query;

        const query = { role: ROLES.STUDENT, isActive: true };

        if (branch) query.branch = branch;
        if (semester) query.semester = parseInt(semester);
        if (section) query.section = section;

        const students = await User.find(query)
            .select('name email rollNumber branch semester section profileImage')
            .sort({ rollNumber: 1 });

        res.json({
            success: true,
            count: students.length,
            students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching students',
            error: error.message
        });
    }
});

// @route   GET /api/users/faculty
// @desc    Get all faculty members
// @access  Private/Admin
router.get('/faculty', protect, isAdmin, async (req, res) => {
    try {
        const { department } = req.query;

        const query = { role: ROLES.FACULTY, isActive: true };
        if (department) query.department = department;

        const faculty = await User.find(query)
            .select('name email employeeId department designation profileImage')
            .sort({ name: 1 });

        res.json({
            success: true,
            count: faculty.length,
            faculty
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching faculty',
            error: error.message
        });
    }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -faceEncoding');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private/Admin or Self
router.put('/:id', protect, async (req, res) => {
    try {
        // Check authorization
        if (req.user.role !== ROLES.ADMIN && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        const {
            name, email, phone, role, semester, section, branch, batch,
            department, designation, rollNumber, employeeId,
            // Additional profile fields
            dateOfBirth, gender, bloodGroup, fatherName, motherName,
            personalEmail, currentAddress, permanentAddress,
            admissionNumber, registrationId, degree, preferences
        } = req.body;

        // Find user first
        const existingUser = await User.findById(req.params.id);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build update data
        const updateData = {};

        // Basic fields
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;

        // Common profile fields (any user can update their own)
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
        if (gender !== undefined) updateData.gender = gender;
        if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
        if (personalEmail !== undefined) updateData.personalEmail = personalEmail;
        if (currentAddress !== undefined) updateData.currentAddress = currentAddress;
        if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress;

        // User preferences
        if (preferences !== undefined) updateData.preferences = preferences;

        // Admin can update role
        if (req.user.role === ROLES.ADMIN && role) {
            updateData.role = role;
        }

        // Student-specific updates
        const targetRole = role || existingUser.role;
        if (targetRole === ROLES.STUDENT || targetRole === 'student') {
            if (semester !== undefined) updateData.semester = semester;
            if (section !== undefined) updateData.section = section;
            if (branch !== undefined) updateData.branch = branch;
            if (batch !== undefined) updateData.batch = batch;
            if (rollNumber !== undefined) updateData.rollNumber = rollNumber;
            if (fatherName !== undefined) updateData.fatherName = fatherName;
            if (motherName !== undefined) updateData.motherName = motherName;
            if (admissionNumber !== undefined) updateData.admissionNumber = admissionNumber;
            if (registrationId !== undefined) updateData.registrationId = registrationId;
            if (degree !== undefined) updateData.degree = degree;
        }

        // Faculty-specific updates
        if (targetRole === ROLES.FACULTY || targetRole === 'faculty') {
            if (department !== undefined) updateData.department = department;
            if (designation !== undefined) updateData.designation = designation;
            if (employeeId !== undefined) updateData.employeeId = employeeId;
        }

        // Admin-specific updates
        if (targetRole === ROLES.ADMIN || targetRole === 'admin') {
            if (department !== undefined) updateData.department = department;
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -faceEncoding');

        res.json({
            success: true,
            message: 'User updated successfully',
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
});

// @route   PUT /api/users/:id/profile-image
// @desc    Update profile image
// @access  Private
router.put('/:id/profile-image', protect, uploadProfile.single('image'), async (req, res) => {
    try {
        if (req.user.role !== ROLES.ADMIN && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload an image'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { profileImage: `/uploads/profiles/${req.file.filename}` },
            { new: true }
        ).select('-password -faceEncoding');

        res.json({
            success: true,
            message: 'Profile image updated',
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating profile image',
            error: error.message
        });
    }
});

// @route   PUT /api/users/:id/toggle-status
// @desc    Activate/Deactivate user
// @access  Private/Admin
router.put('/:id/toggle-status', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            isActive: user.isActive
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating user status',
            error: error.message
        });
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
});

module.exports = router;
