const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRE, ROLES } = require('../config/constants');
const { protect } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

// @route   POST /api/auth/register
// @desc    Register a new user (Admin only in production)
// @access  Public (for demo) / Admin
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, rollNumber, semester, branch, section, batch, employeeId, department, designation, phone } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user object based on role
        const userData = {
            name,
            email,
            password,
            role: role || ROLES.STUDENT,
            phone
        };

        // Add role-specific fields
        if (role === ROLES.STUDENT || role === 'student') {
            userData.rollNumber = rollNumber;
            userData.semester = semester;
            userData.branch = branch;
            userData.section = section;
            userData.batch = batch;
        } else if (role === ROLES.FACULTY || role === 'faculty') {
            userData.employeeId = employeeId;
            userData.department = department;
            userData.designation = designation;
        }

        const user = await User.create(userData);
        const token = generateToken(user._id);

        // Send welcome email
        if (global.EmailService) {
            global.EmailService.sendWelcomeEmail({
                name: user.name,
                email: user.email,
                role: user.role,
                rollNumber: user.rollNumber,
                employeeId: user.employeeId
            }).catch(err => console.error('Welcome email failed:', err.message));
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: user.getProfile()
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering user',
            error: error.message
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user and include password for comparison
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if role matches (if role is provided)
        if (role && user.role !== role) {
            return res.status(401).json({
                success: false,
                message: `This account is not registered as ${role}`
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated. Please contact admin.'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: user.getProfile()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            user: user.getProfile()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
});

// @route   PUT /api/auth/password
// @desc    Update password
// @access  Private
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Password updated successfully',
            token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating password',
            error: error.message
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Forgot password - send reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with this email'
            });
        }

        // Generate reset token
        const resetToken = user.generatePasswordResetToken();
        await user.save({ validateBeforeSave: false });

        // Determine the correct app URL based on environment
        const appUrl = process.env.NODE_ENV === 'production'
            ? (process.env.APP_URL_PROD || process.env.APP_URL)
            : (process.env.APP_URL_DEV || process.env.APP_URL || 'http://localhost:3000');

        // Send email
        if (global.EmailService) {
            try {
                await global.EmailService.sendPasswordResetEmail(user, resetToken);
                console.log(`Password reset email sent to ${email}`);
            } catch (emailError) {
                console.error('Email send error:', emailError);
                // Don't return error to user for security
            }
        }

        res.json({
            success: true,
            message: 'Password reset instructions sent to your email'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error.message
        });
    }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password } = req.body;

        // Hash token from URL
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Set new password
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Password reset successfully',
            token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
});

// @route   POST /api/auth/request-password-change
// @desc    Request OTP for password change (for logged in users)
// @access  Private
router.post('/request-password-change', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate OTP
        const otp = user.generatePasswordChangeOTP();
        await user.save({ validateBeforeSave: false });

        // Send OTP via email
        if (global.EmailService) {
            try {
                await global.EmailService.sendPasswordChangeOTP(user, otp);
            } catch (emailError) {
                console.error('OTP email send error:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Verification code sent to your email'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error requesting password change',
            error: error.message
        });
    }
});

// @route   POST /api/auth/verify-change-password
// @desc    Verify OTP and change password
// @access  Private
router.post('/verify-change-password', protect, async (req, res) => {
    try {
        const { otp, newPassword } = req.body;

        if (!otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'OTP and new password are required'
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify OTP
        if (!user.verifyPasswordChangeOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // Update password
        user.password = newPassword;
        user.passwordChangeOTP = undefined;
        user.passwordChangeOTPExpires = undefined;
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Password changed successfully',
            token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @route   PUT /api/auth/update-profile
// @desc    Update user profile
// @access  Private
router.put('/update-profile', protect, async (req, res) => {
    try {
        const { name, email, phone, department } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (department) user.department = department;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                department: user.department
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
});

module.exports = router;
