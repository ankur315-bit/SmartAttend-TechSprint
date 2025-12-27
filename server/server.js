const path = require('path');
const http = require('http');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

// Import configurations
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const socketHandler = require('./socket');

// Import services
const EmailService = require('./services/emailService');

// Make email service globally available
global.EmailService = EmailService;

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Make io accessible to routes
app.set('io', io);

// Setup socket handlers
socketHandler(io);

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware to serve HTML files without .html extension
app.use((req, res, next) => {
    // Skip API routes, static files with extensions, and root
    if (req.path.indexOf('.') !== -1 || req.path.startsWith('/api') || req.path === '/') {
        return next();
    }

    const fs = require('fs');
    const cleanPath = req.path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes

    // Handle /pages/* routes
    if (cleanPath.startsWith('pages/')) {
        const pageName = cleanPath.replace('pages/', '');
        const pagesPath = path.join(__dirname, '../public/pages', pageName + '.html');
        if (fs.existsSync(pagesPath)) {
            return res.sendFile(pagesPath);
        }
    }

    // Try root public folder
    const filePath = path.join(__dirname, '../public', cleanPath + '.html');
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    // Try pages folder (for direct page access without /pages prefix)
    const pagesPath = path.join(__dirname, '../public/pages', cleanPath + '.html');
    if (fs.existsSync(pagesPath)) {
        return res.sendFile(pagesPath);
    }

    next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/wifi', require('./routes/wifi'));
app.use('/api/face', require('./routes/face'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/chatbot', require('./routes/chatbot'));

// API Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Smart Attendance API is running',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '../public/pages/404.html'));
    } else {
        res.status(404).json({
            success: false,
            message: 'Route not found'
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎓 Smart Attendance System                              ║
║   Server running on port ${PORT}                            ║
║   http://localhost:${PORT}                                  ║
║                                                           ║
║   API Endpoints:                                          ║
║   • Auth:       /api/auth                                 ║
║   • Users:      /api/users                                ║
║   • Attendance: /api/attendance                           ║
║   • Timetable:  /api/timetable                           ║
║   • Subjects:   /api/subjects                             ║
║   • Notices:    /api/notices                              ║
║   • WiFi:       /api/wifi                                 ║
║   • Face:       /api/face                                 ║
║   • Admin:      /api/admin                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});