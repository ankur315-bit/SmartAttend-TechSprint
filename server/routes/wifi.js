const express = require('express');
const router = express.Router();
const WifiSession = require('../models/WifiSession');
const AttendanceSession = require('../models/AttendanceSession');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// @route   GET /api/wifi/sessions
// @desc    Get WiFi sessions for activity log
// @access  Private/Admin
router.get('/sessions', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const sessions = await WifiSession.find()
            .sort({ startedAt: -1 })
            .limit(limit)
            .populate('faculty', 'name')
            .populate('attendanceSession', 'subject');

        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sessions',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/create-hotspot
// @desc    Faculty creates a WiFi hotspot for attendance
// @access  Private/Faculty
router.post('/create-hotspot', protect, authorize(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
    try {
        const { attendanceSessionId, ssid, bssid, ipAddress, location } = req.body;

        // Check if faculty already has an active hotspot
        const existingSession = await WifiSession.findOne({
            faculty: req.user.id,
            status: 'active'
        });

        if (existingSession) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active WiFi session',
                existingSession: {
                    id: existingSession._id,
                    ssid: existingSession.hotspot.ssid
                }
            });
        }

        // Generate unique SSID if not provided
        const generatedSSID = ssid || `ATTEND_${req.user.name.split(' ')[0].toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;

        const wifiSession = await WifiSession.create({
            attendanceSession: attendanceSessionId,
            faculty: req.user.id,
            hotspot: {
                ssid: generatedSSID,
                bssid: bssid,
                ipAddress: ipAddress,
                gatewayIP: ipAddress?.split('.').slice(0, 3).join('.') + '.1'
            },
            geofence: {
                centerLatitude: location?.latitude,
                centerLongitude: location?.longitude,
                radius: 50
            },
            status: 'active',
            startedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'WiFi hotspot session created',
            wifiSession: {
                id: wifiSession._id,
                ssid: wifiSession.hotspot.ssid,
                status: wifiSession.status
            },
            instructions: {
                step1: `Create a mobile hotspot with name: ${generatedSSID}`,
                step2: 'Students will connect to this hotspot',
                step3: 'Their IP addresses will be captured for verification'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating WiFi session',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/connect
// @desc    Student connects to WiFi hotspot
// @access  Private/Student
router.post('/connect', protect, authorize(ROLES.STUDENT), async (req, res) => {
    try {
        const { ssid, ipAddress, macAddress, deviceInfo } = req.body;

        // Find active WiFi session with this SSID
        const wifiSession = await WifiSession.findOne({
            'hotspot.ssid': ssid,
            status: 'active'
        });

        if (!wifiSession) {
            return res.status(404).json({
                success: false,
                message: 'No active attendance session found with this WiFi network',
                hint: 'Make sure you are connected to the teacher\'s hotspot'
            });
        }

        // Check if student already connected
        const existingDevice = wifiSession.connectedDevices.find(
            d => d.student?.toString() === req.user.id
        );

        if (existingDevice) {
            // Update device info
            existingDevice.ipAddress = ipAddress;
            existingDevice.connectedAt = new Date();
        } else {
            // Add new device
            wifiSession.connectedDevices.push({
                student: req.user.id,
                ipAddress,
                macAddress,
                deviceInfo,
                connectedAt: new Date(),
                isVerified: false
            });
        }

        await wifiSession.save();

        // Emit real-time update to faculty
        const io = req.app.get('io');
        if (io) {
            io.to(`session_${wifiSession.attendanceSession}`).emit('studentConnected', {
                studentId: req.user.id,
                studentName: req.user.name,
                rollNumber: req.user.rollNumber,
                ipAddress,
                connectedAt: new Date()
            });
        }

        res.json({
            success: true,
            message: 'Connected to attendance WiFi',
            wifiSessionId: wifiSession._id,
            attendanceSessionId: wifiSession.attendanceSession,
            nextStep: 'location_verification'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error connecting to WiFi session',
            error: error.message
        });
    }
});

// @route   GET /api/wifi/session/:id/devices
// @desc    Get connected devices for a WiFi session
// @access  Private/Faculty
router.get('/session/:id/devices', protect, authorize(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
    try {
        const wifiSession = await WifiSession.findById(req.params.id)
            .populate('connectedDevices.student', 'name rollNumber profileImage branch section');

        if (!wifiSession) {
            return res.status(404).json({
                success: false,
                message: 'WiFi session not found'
            });
        }

        // Verify ownership
        if (wifiSession.faculty.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this session'
            });
        }

        res.json({
            success: true,
            ssid: wifiSession.hotspot.ssid,
            status: wifiSession.status,
            connectedCount: wifiSession.connectedDevices.length,
            devices: wifiSession.connectedDevices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching connected devices',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/session/:id/end
// @desc    End WiFi session
// @access  Private/Faculty
router.post('/session/:id/end', protect, authorize(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
    try {
        const wifiSession = await WifiSession.findById(req.params.id);

        if (!wifiSession) {
            return res.status(404).json({
                success: false,
                message: 'WiFi session not found'
            });
        }

        if (wifiSession.faculty.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to end this session'
            });
        }

        wifiSession.status = 'inactive';
        wifiSession.endedAt = new Date();
        await wifiSession.save();

        res.json({
            success: true,
            message: 'WiFi session ended',
            totalConnected: wifiSession.connectedDevices.length,
            duration: Math.round((wifiSession.endedAt - wifiSession.startedAt) / 60000)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error ending WiFi session',
            error: error.message
        });
    }
});

// @route   GET /api/wifi/active
// @desc    Get active WiFi sessions for student's class
// @access  Private/Student
router.get('/active', protect, authorize(ROLES.STUDENT), async (req, res) => {
    try {
        // Find active WiFi sessions
        const activeSessions = await WifiSession.find({ status: 'active' })
            .populate({
                path: 'attendanceSession',
                populate: [
                    { path: 'subject', select: 'name code' },
                    { path: 'faculty', select: 'name' }
                ]
            });

        // Filter sessions relevant to student
        const relevantSessions = activeSessions.filter(ws => {
            const session = ws.attendanceSession;
            return session && session.status === 'active';
        });

        res.json({
            success: true,
            count: relevantSessions.length,
            sessions: relevantSessions.map(ws => ({
                wifiSessionId: ws._id,
                attendanceSessionId: ws.attendanceSession._id,
                ssid: ws.hotspot.ssid,
                subject: ws.attendanceSession.subject,
                faculty: ws.attendanceSession.faculty,
                startedAt: ws.startedAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching active sessions',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/verify-ip
// @desc    Verify student's IP is in the allowed range
// @access  Private/Student
router.post('/verify-ip', protect, authorize(ROLES.STUDENT), async (req, res) => {
    try {
        const { wifiSessionId, ipAddress } = req.body;

        const wifiSession = await WifiSession.findById(wifiSessionId);

        if (!wifiSession || wifiSession.status !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'WiFi session not found or inactive'
            });
        }

        // Find student's device in connected devices
        const device = wifiSession.connectedDevices.find(
            d => d.student?.toString() === req.user.id
        );

        if (!device) {
            return res.status(400).json({
                success: false,
                message: 'You are not connected to this WiFi network'
            });
        }

        // Verify IP matches
        const isIPValid = device.ipAddress === ipAddress;

        // Check if IP is in the hotspot's subnet
        const teacherIP = wifiSession.hotspot.ipAddress;
        const teacherSubnet = teacherIP?.split('.').slice(0, 3).join('.');
        const studentSubnet = ipAddress?.split('.').slice(0, 3).join('.');
        const isInSubnet = teacherSubnet === studentSubnet;

        if (isIPValid && isInSubnet) {
            device.isVerified = true;
            await wifiSession.save();

            return res.json({
                success: true,
                verified: true,
                message: 'IP verification successful',
                nextStep: 'geolocation_check'
            });
        }

        res.status(400).json({
            success: false,
            verified: false,
            message: 'IP verification failed. Make sure you are connected to the correct hotspot.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying IP',
            error: error.message
        });
    }
});

// ===== GEOFENCE MANAGEMENT ROUTES =====

// @route   GET /api/wifi/geofences
// @desc    Get all configured geofences
// @access  Private/Admin
router.get('/geofences', protect, authorize(ROLES.ADMIN), async (req, res) => {
    try {
        // For now, return geofences from active wifi sessions
        const sessions = await WifiSession.find({ status: 'active' })
            .select('hotspot geofence createdAt')
            .lean();

        const geofences = sessions.map(session => ({
            _id: session._id,
            name: session.hotspot.ssid || 'Unnamed Location',
            latitude: session.geofence.centerLatitude || 0,
            longitude: session.geofence.centerLongitude || 0,
            radius: session.geofence.radius || 50,
            isActive: true,
            createdAt: session.createdAt
        }));

        res.json({
            success: true,
            geofences: geofences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching geofences',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/geofence
// @desc    Create a new geofence
// @access  Private/Admin
router.post('/geofence', protect, authorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { name, latitude, longitude, radius, description } = req.body;

        // Create a wifi session as geofence marker
        const geofence = await WifiSession.create({
            faculty: req.user.id,
            hotspot: {
                ssid: name,
                description: description
            },
            geofence: {
                centerLatitude: latitude,
                centerLongitude: longitude,
                radius: radius || 50
            },
            status: 'active',
            startedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Geofence created successfully',
            geofence: {
                _id: geofence._id,
                name: geofence.hotspot.ssid,
                latitude: geofence.geofence.centerLatitude,
                longitude: geofence.geofence.centerLongitude,
                radius: geofence.geofence.radius
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating geofence',
            error: error.message
        });
    }
});

// @route   GET /api/wifi/geofence/:id
// @desc    Get single geofence
// @access  Private/Admin
router.get('/geofence/:id', protect, authorize(ROLES.ADMIN), async (req, res) => {
    try {
        const session = await WifiSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Geofence not found'
            });
        }

        res.json({
            success: true,
            geofence: {
                _id: session._id,
                name: session.hotspot.ssid,
                latitude: session.geofence.centerLatitude,
                longitude: session.geofence.centerLongitude,
                radius: session.geofence.radius,
                description: session.hotspot.description
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching geofence',
            error: error.message
        });
    }
});

// @route   PUT /api/wifi/geofence/:id
// @desc    Update geofence
// @access  Private/Admin
router.put('/geofence/:id', protect, authorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { name, latitude, longitude, radius, description } = req.body;

        const session = await WifiSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Geofence not found'
            });
        }

        // Update fields
        if (name) session.hotspot.ssid = name;
        if (description !== undefined) session.hotspot.description = description;
        if (latitude) session.geofence.centerLatitude = latitude;
        if (longitude) session.geofence.centerLongitude = longitude;
        if (radius) session.geofence.radius = radius;

        await session.save();

        res.json({
            success: true,
            message: 'Geofence updated successfully',
            geofence: {
                _id: session._id,
                name: session.hotspot.ssid,
                latitude: session.geofence.centerLatitude,
                longitude: session.geofence.centerLongitude,
                radius: session.geofence.radius
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating geofence',
            error: error.message
        });
    }
});

// @route   DELETE /api/wifi/geofence/:id
// @desc    Delete geofence
// @access  Private/Admin
router.delete('/geofence/:id', protect, authorize(ROLES.ADMIN), async (req, res) => {
    try {
        const session = await WifiSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Geofence not found'
            });
        }

        await session.deleteOne();

        res.json({
            success: true,
            message: 'Geofence deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting geofence',
            error: error.message
        });
    }
});

// @route   GET /api/wifi/geofences
// @desc    Get all geofences
// @access  Private/Admin
router.get('/geofences', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), async (req, res) => {
    try {
        // For now, return empty array as geofences are part of wifi sessions
        // You may want to create a separate Geofence model
        const wifiSessions = await WifiSession.find({
            geofence: { $exists: true },
            status: 'active'
        }).select('geofence hotspot');

        const geofences = wifiSessions.map((session, index) => ({
            _id: session._id,
            name: session.hotspot?.ssid || `Geofence ${index + 1}`,
            latitude: session.geofence?.centerLatitude || 0,
            longitude: session.geofence?.centerLongitude || 0,
            radius: session.geofence?.radius || 50,
            description: `WiFi Session Geofence`
        }));

        res.json({
            success: true,
            count: geofences.length,
            geofences
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching geofences',
            error: error.message
        });
    }
});

// @route   POST /api/wifi/geofence
// @desc    Create a geofence
// @access  Private/Admin
router.post('/geofence', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), async (req, res) => {
    try {
        const { name, latitude, longitude, radius, description } = req.body;

        if (!name || !latitude || !longitude || !radius) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, latitude, longitude, and radius'
            });
        }

        // Create a wifi session with geofence
        const wifiSession = await WifiSession.create({
            faculty: req.user.id,
            hotspot: {
                ssid: name,
                bssid: null,
                ipAddress: null,
                gatewayIP: null
            },
            geofence: {
                centerLatitude: parseFloat(latitude),
                centerLongitude: parseFloat(longitude),
                radius: parseInt(radius)
            },
            status: 'pending',
            description: description
        });

        res.status(201).json({
            success: true,
            message: 'Geofence created successfully',
            geofence: {
                _id: wifiSession._id,
                name,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                radius: parseInt(radius),
                description
            }
        });
    } catch (error) {
        console.error('Geofence creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating geofence',
            error: error.message
        });
    }
});

// @route   PUT /api/wifi/geofence/:id
// @desc    Update a geofence
// @access  Private/Admin
router.put('/geofence/:id', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), async (req, res) => {
    try {
        const { name, latitude, longitude, radius, description } = req.body;

        const wifiSession = await WifiSession.findById(req.params.id);
        if (!wifiSession) {
            return res.status(404).json({
                success: false,
                message: 'Geofence not found'
            });
        }

        if (name) wifiSession.hotspot.ssid = name;
        if (latitude) wifiSession.geofence.centerLatitude = parseFloat(latitude);
        if (longitude) wifiSession.geofence.centerLongitude = parseFloat(longitude);
        if (radius) wifiSession.geofence.radius = parseInt(radius);
        if (description) wifiSession.description = description;

        await wifiSession.save();

        res.json({
            success: true,
            message: 'Geofence updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating geofence',
            error: error.message
        });
    }
});

// @route   DELETE /api/wifi/geofence/:id
// @desc    Delete a geofence
// @access  Private/Admin
router.delete('/geofence/:id', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), async (req, res) => {
    try {
        const wifiSession = await WifiSession.findById(req.params.id);
        if (!wifiSession) {
            return res.status(404).json({
                success: false,
                message: 'Geofence not found'
            });
        }

        await wifiSession.deleteOne();

        res.json({
            success: true,
            message: 'Geofence deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting geofence',
            error: error.message
        });
    }
});

module.exports = router;
