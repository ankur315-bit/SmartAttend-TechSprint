const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { uploadFace } = require('../middleware/upload');
const { ROLES, FACE_MATCH_THRESHOLD } = require('../config/constants');

// @route   POST /api/face/register
// @desc    Register face for a user
// @access  Private
router.post('/register', protect, uploadFace.single('faceImage'), async (req, res) => {
    try {
        const { faceEncoding } = req.body;

        if (!req.file && !faceEncoding) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a face image or encoding'
            });
        }

        // Parse face encoding if provided as string
        let encoding = faceEncoding;
        if (typeof faceEncoding === 'string') {
            try {
                encoding = JSON.parse(faceEncoding);
            } catch (e) {
                encoding = faceEncoding.split(',').map(Number);
            }
        }

        const user = await User.findById(req.user.id);

        // Store face encoding
        if (encoding && Array.isArray(encoding)) {
            user.faceEncoding = encoding;
        }

        // Store face image path
        if (req.file) {
            user.profileImage = `/uploads/faces/${req.file.filename}`;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Face registered successfully',
            hasEncoding: user.faceEncoding.length > 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error registering face',
            error: error.message
        });
    }
});

// @route   POST /api/face/verify
// @desc    Verify face for attendance
// @access  Private/Student
router.post('/verify', protect, authorize(ROLES.STUDENT), uploadFace.single('faceImage'), async (req, res) => {
    try {
        const { faceEncoding, capturedImageBase64 } = req.body;

        const user = await User.findById(req.user.id);

        // If user has no registered face, allow first-time registration
        if (!user.faceEncoding || user.faceEncoding.length === 0) {
            // Register this face
            if (faceEncoding) {
                let encoding = faceEncoding;
                if (typeof faceEncoding === 'string') {
                    try {
                        encoding = JSON.parse(faceEncoding);
                    } catch (e) {
                        encoding = faceEncoding.split(',').map(Number);
                    }
                }
                user.faceEncoding = encoding;
                await user.save();
            }

            return res.json({
                success: true,
                verified: true,
                firstTimeRegistration: true,
                message: 'Face registered and verified',
                confidence: 1.0
            });
        }

        // Compare face encodings
        let capturedEncoding = faceEncoding;
        if (typeof faceEncoding === 'string') {
            try {
                capturedEncoding = JSON.parse(faceEncoding);
            } catch (e) {
                capturedEncoding = faceEncoding.split(',').map(Number);
            }
        }

        // Calculate similarity (Euclidean distance for face encodings)
        const similarity = calculateFaceSimilarity(user.faceEncoding, capturedEncoding);
        const isMatch = similarity >= FACE_MATCH_THRESHOLD;

        if (isMatch) {
            return res.json({
                success: true,
                verified: true,
                message: 'Face verification successful',
                confidence: similarity
            });
        }

        res.status(400).json({
            success: false,
            verified: false,
            message: 'Face verification failed. Face does not match registered face.',
            confidence: similarity,
            required: FACE_MATCH_THRESHOLD
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying face',
            error: error.message
        });
    }
});

// @route   GET /api/face/status
// @desc    Check if user has registered face
// @access  Private
router.get('/status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            hasFaceRegistered: user.faceEncoding && user.faceEncoding.length > 0,
            hasProfileImage: !!user.profileImage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error checking face status',
            error: error.message
        });
    }
});

// @route   DELETE /api/face/remove
// @desc    Remove registered face
// @access  Private
router.delete('/remove', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        user.faceEncoding = [];
        await user.save();

        res.json({
            success: true,
            message: 'Face data removed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing face data',
            error: error.message
        });
    }
});

// Helper function: Calculate face similarity using Euclidean distance
function calculateFaceSimilarity(encoding1, encoding2) {
    if (!encoding1 || !encoding2 || encoding1.length !== encoding2.length) {
        return 0;
    }

    // Calculate Euclidean distance
    let sumSquares = 0;
    for (let i = 0; i < encoding1.length; i++) {
        sumSquares += Math.pow(encoding1[i] - encoding2[i], 2);
    }
    const distance = Math.sqrt(sumSquares);

    // Convert distance to similarity (0 to 1)
    // Typical face encoding distances: same person < 0.6, different person > 0.6
    const similarity = Math.max(0, 1 - (distance / 1.5));

    return similarity;
}

module.exports = router;
