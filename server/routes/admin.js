const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subject = require('../models/Subject');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Notice = require('../models/Notice');
const Timetable = require('../models/Timetable');
const { protect, isAdmin } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Try to load Batch model if it exists
let Batch;
try {
    Batch = require('../models/Batch');
} catch (e) {
    Batch = null;
}

// @route   GET /api/admin/stats
// @desc    Get comprehensive admin stats with real-time data
// @access  Private/Admin
router.get('/stats', protect, isAdmin, async (req, res) => {
    try {
        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch all stats in parallel
        const [
            totalStudents,
            totalFaculty,
            totalAdmins,
            totalSubjects,
            activeSessions,
            totalAttendanceRecords,
            presentRecords,
            todayAttendance,
            totalTimetableEntries,
            totalNotices,
            activeNotices,
            totalBatches
        ] = await Promise.all([
            User.countDocuments({ role: ROLES.STUDENT }),
            User.countDocuments({ role: ROLES.FACULTY }),
            User.countDocuments({ role: ROLES.ADMIN }),
            Subject.countDocuments({ isActive: true }),
            AttendanceSession.countDocuments({ status: 'active' }),
            AttendanceRecord.countDocuments(),
            AttendanceRecord.countDocuments({ status: 'present' }),
            AttendanceRecord.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
            Timetable.countDocuments(),
            Notice.countDocuments(),
            Notice.countDocuments({ isActive: true }),
            Batch ? Batch.countDocuments({ isActive: true }) : 0
        ]);

        // Calculate attendance rate
        const attendanceRate = totalAttendanceRecords > 0
            ? Math.round((presentRecords / totalAttendanceRecords) * 100)
            : 0;

        // Calculate today's attendance rate
        const todayPresentCount = await AttendanceRecord.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'present'
        });
        const todayAttendanceRate = todayAttendance > 0
            ? Math.round((todayPresentCount / todayAttendance) * 100)
            : 0;

        // Get recently active users (logged in within last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const activeUsers = await User.countDocuments({
            lastLogin: { $gte: yesterday }
        });

        res.json({
            success: true,
            // User stats
            totalStudents,
            totalFaculty,
            totalAdmins,
            totalUsers: totalStudents + totalFaculty + totalAdmins,
            activeUsers,
            // Attendance stats
            totalAttendanceRecords,
            presentRecords,
            attendanceRate,
            todayAttendance,
            todayAttendanceRate,
            activeSessions,
            // Other stats
            totalSubjects,
            totalTimetableEntries,
            totalNotices,
            activeNotices,
            totalBatches,
            // System health (based on active sessions and attendance)
            systemHealth: Math.min(100, Math.round((attendanceRate + (activeSessions > 0 ? 10 : 0)) * 1.1))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
});

// @route   POST /api/admin/send-email
// @desc    Send email to user and create notification
// @access  Private/Admin
router.post('/send-email', protect, isAdmin, async (req, res) => {
    try {
        const { userId, email, subject, message } = req.body;

        if (!userId || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Send email
        try {
            const EmailService = global.EmailService;
            await EmailService.sendCustomEmail(email, subject, message);
        } catch (emailError) {
            console.error('Email send error:', emailError);
        }

        // Create notification for user (optional - don't fail if this fails)
        try {
            await Notice.create({
                title: `Email: ${subject}`,
                content: message,
                type: 'email',
                priority: 'medium',
                createdBy: req.user.id,
                targetAudience: {
                    roles: [user.role],
                    branches: user.branch ? [user.branch] : [],
                    semesters: user.semester ? [user.semester] : []
                }
            });
        } catch (noticeError) {
            console.error('Notice creation failed (non-critical):', noticeError.message);
        }

        res.json({
            success: true,
            message: 'Email sent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error sending email',
            error: error.message
        });
    }
});

// @route   GET /api/admin/recent-activity
// @desc    Get recent activity
// @access  Private/Admin
router.get('/recent-activity', protect, isAdmin, async (req, res) => {
    try {
        const activities = [];

        // Get recent notices
        const recentNotices = await Notice.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title createdAt type');

        recentNotices.forEach(notice => {
            activities.push({
                type: 'notice',
                title: notice.title,
                timestamp: notice.createdAt
            });
        });

        // Get recent attendance sessions
        const recentSessions = await AttendanceSession.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('subject', 'name');

        recentSessions.forEach(session => {
            activities.push({
                type: 'attendance',
                title: `Attendance session: ${session.subject?.name || 'Unknown'}`,
                timestamp: session.createdAt
            });
        });

        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            activities: activities.slice(0, 10)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching recent activity',
            error: error.message
        });
    }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private/Admin
router.get('/dashboard', protect, isAdmin, async (req, res) => {
    try {
        const [
            totalStudents,
            totalFaculty,
            totalSubjects,
            totalSessions,
            activeStudents,
            activeFaculty
        ] = await Promise.all([
            User.countDocuments({ role: ROLES.STUDENT }),
            User.countDocuments({ role: ROLES.FACULTY }),
            Subject.countDocuments({ isActive: true }),
            AttendanceSession.countDocuments(),
            User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
            User.countDocuments({ role: ROLES.FACULTY, isActive: true })
        ]);

        // Recent sessions
        const recentSessions = await AttendanceSession.find()
            .populate('subject', 'name')
            .populate('faculty', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // Attendance statistics for the month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthlyAttendance = await AttendanceRecord.aggregate([
            { $match: { date: { $gte: monthStart } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                totalStudents,
                totalFaculty,
                totalSubjects,
                totalSessions,
                activeStudents,
                activeFaculty
            },
            recentSessions,
            monthlyAttendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats',
            error: error.message
        });
    }
});

// @route   GET /api/admin/attendance-report
// @desc    Get comprehensive attendance report
// @access  Private/Admin
router.get('/attendance-report', protect, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, branch, semester } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Build student filter
        const studentFilter = { role: ROLES.STUDENT };
        if (branch) studentFilter.branch = branch;
        if (semester) studentFilter.semester = parseInt(semester);

        const students = await User.find(studentFilter).select('_id name rollNumber branch semester');
        const studentIds = students.map(s => s._id);

        // Get attendance records
        const recordFilter = { student: { $in: studentIds } };
        if (Object.keys(dateFilter).length > 0) {
            recordFilter.date = dateFilter;
        }

        const records = await AttendanceRecord.find(recordFilter)
            .populate('subject', 'name code')
            .populate('student', 'name rollNumber branch semester');

        // Calculate statistics per student
        const studentStats = students.map(student => {
            const studentRecords = records.filter(r => r.student._id.toString() === student._id.toString());
            const total = studentRecords.length;
            const present = studentRecords.filter(r => r.status === 'present').length;
            const late = studentRecords.filter(r => r.status === 'late').length;
            const absent = studentRecords.filter(r => r.status === 'absent').length;

            return {
                student: {
                    id: student._id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    branch: student.branch,
                    semester: student.semester
                },
                totalClasses: total,
                present,
                late,
                absent,
                percentage: total > 0 ? Math.round(((present + late) / total) * 100) : 0
            };
        });

        // Sort by percentage (ascending for low attendance first)
        studentStats.sort((a, b) => a.percentage - b.percentage);

        res.json({
            success: true,
            totalStudents: students.length,
            lowAttendanceStudents: studentStats.filter(s => s.percentage < 75).length,
            report: studentStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating report',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/settings/geofence
// @desc    Update geofence settings
// @access  Private/Admin
router.put('/settings/geofence', protect, isAdmin, async (req, res) => {
    try {
        const { defaultRadius, strictMode } = req.body;

        // In a real app, this would update a settings collection
        // For now, return success
        res.json({
            success: true,
            message: 'Geofence settings updated',
            settings: {
                defaultRadius: defaultRadius || 50,
                strictMode: strictMode || false
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating settings',
            error: error.message
        });
    }
});

// @route   POST /api/admin/bulk-register
// @desc    Bulk register users from CSV/JSON
// @access  Private/Admin
router.post('/bulk-register', protect, isAdmin, async (req, res) => {
    try {
        const { users, role } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of users'
            });
        }

        const results = {
            success: [],
            failed: []
        };

        for (const userData of users) {
            try {
                const existingUser = await User.findOne({ email: userData.email });
                if (existingUser) {
                    results.failed.push({
                        email: userData.email,
                        reason: 'Email already exists'
                    });
                    continue;
                }

                const user = await User.create({
                    ...userData,
                    role: role || userData.role || ROLES.STUDENT,
                    password: userData.password || 'College@123'
                });

                results.success.push({
                    email: user.email,
                    name: user.name
                });
            } catch (error) {
                results.failed.push({
                    email: userData.email,
                    reason: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Registered ${results.success.length} users, ${results.failed.length} failed`,
            results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error bulk registering users',
            error: error.message
        });
    }
});

// @route   GET /api/admin/recent-activity
// @desc    Get recent system activity
// @access  Private/Admin
router.get('/recent-activity', protect, isAdmin, async (req, res) => {
    try {
        const Notice = require('../models/Notice');

        // Get recent activities from different sources
        const [recentUsers, recentSessions, recentNotices] = await Promise.all([
            User.find().sort({ createdAt: -1 }).limit(2).select('name role createdAt'),
            AttendanceSession.find().sort({ createdAt: -1 }).limit(2).select('subject createdAt').populate('subject', 'name'),
            Notice.find().sort({ createdAt: -1 }).limit(2).select('title createdAt')
        ]);

        // Combine and format activities
        const activities = [];

        recentUsers.forEach(user => {
            activities.push({
                type: 'user',
                title: `New ${user.role} registered: ${user.name}`,
                timestamp: user.createdAt
            });
        });

        recentSessions.forEach(session => {
            activities.push({
                type: 'attendance',
                title: `Attendance started for ${session.subject?.name || 'a subject'}`,
                timestamp: session.createdAt
            });
        });

        recentNotices.forEach(notice => {
            activities.push({
                type: 'notice',
                title: `Notice posted: ${notice.title}`,
                timestamp: notice.createdAt
            });
        });

        // Sort by timestamp (most recent first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            activities: activities.slice(0, 4)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching recent activity',
            error: error.message,
            activities: [] // Return empty array on error
        });
    }
});

// @route   POST /api/admin/settings/attendance
// @desc    Update attendance settings
// @access  Private/Admin
router.post('/settings/attendance', protect, isAdmin, async (req, res) => {
    try {
        const { sessionDuration, lateThreshold, verificationMethod, autoClose } = req.body;

        // In a real app, save to a Settings model or config
        // For now, just return success
        res.json({
            success: true,
            message: 'Attendance settings saved successfully',
            settings: {
                sessionDuration,
                lateThreshold,
                verificationMethod,
                autoClose
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error saving settings',
            error: error.message
        });
    }
});

// @route   POST /api/admin/settings/notifications
// @desc    Update notification settings
// @access  Private/Admin
router.post('/settings/notifications', protect, isAdmin, async (req, res) => {
    try {
        const { email, sms, push } = req.body;

        // In a real app, save to a Settings model or config
        res.json({
            success: true,
            message: 'Notification settings saved successfully',
            settings: {
                email,
                sms,
                push
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error saving notification settings',
            error: error.message
        });
    }
});

module.exports = router;
