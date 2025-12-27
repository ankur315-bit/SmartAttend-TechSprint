const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, ROLES } = require('../config/constants');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User account is deactivated'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

// Check if user is admin
exports.isAdmin = (req, res, next) => {
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

// Check if user is faculty
exports.isFaculty = (req, res, next) => {
    if (req.user.role !== ROLES.FACULTY && req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
            success: false,
            message: 'Faculty access required'
        });
    }
    next();
};

// Check if user is student
exports.isStudent = (req, res, next) => {
    if (req.user.role !== ROLES.STUDENT) {
        return res.status(403).json({
            success: false,
            message: 'Student access required'
        });
    }
    next();
};
