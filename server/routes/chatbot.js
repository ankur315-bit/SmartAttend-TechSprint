const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Google AI Studio API configuration
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || '';
const GOOGLE_AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// System prompt for the attendance chatbot
const SYSTEM_PROMPT = `You are a helpful assistant for the Smart Attendance System. You help students and faculty with:
- Attendance-related queries
- Understanding attendance policies
- Timetable information
- Technical support for the attendance app
- General academic queries

Be friendly, concise, and helpful. If you don't know something specific about the user's attendance data, suggest they check their dashboard or contact the admin.`;

// Chat history storage (in production, use database)
const chatHistory = new Map();

// Optional auth middleware - doesn't block unauthenticated users
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                req.user = user;
            }
        }
    } catch (error) {
        // Ignore auth errors - just proceed without user
    }
    next();
};

// @route   POST /api/chatbot/chat
// @desc    Send message to AI chatbot
// @access  Public (with optional auth for personalized responses)
router.post('/chat', optionalAuth, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user?.id || req.ip || 'anonymous';

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a message'
            });
        }

        // Get or create chat history for user
        if (!chatHistory.has(userId)) {
            chatHistory.set(userId, []);
        }
        const userHistory = chatHistory.get(userId);

        // Add user message to history
        userHistory.push({ role: 'user', content: message });

        // Keep only last 10 messages for context
        if (userHistory.length > 20) {
            userHistory.splice(0, userHistory.length - 20);
        }

        // Prepare context with user info (if authenticated)
        let userContext = '';
        if (req.user) {
            userContext = `
User Information:
- Name: ${req.user.name}
- Role: ${req.user.role}
- Email: ${req.user.email}
${req.user.rollNumber ? `- Roll Number: ${req.user.rollNumber}` : ''}
${req.user.branch ? `- Branch: ${req.user.branch}` : ''}
${req.user.semester ? `- Semester: ${req.user.semester}` : ''}
${req.user.department ? `- Department: ${req.user.department}` : ''}`;
        } else {
            userContext = 'User is not logged in - provide general assistance.';
        }

        let aiResponse;

        // Check if Google AI API key is available
        if (GOOGLE_AI_API_KEY) {
            try {
                const response = await fetch(`${GOOGLE_AI_API_URL}?key=${GOOGLE_AI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: `${SYSTEM_PROMPT}\n\n${userContext}\n\nChat History:\n${userHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nUser: ${message}` }
                                ]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 500
                        }
                    })
                });

                const data = await response.json();

                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error('Invalid response from AI');
                }
            } catch (aiError) {
                console.error('Google AI API error:', aiError.message);
                aiResponse = getSmartFallbackResponse(message, req.user);
            }
        } else {
            // Fallback to smart responses without AI
            aiResponse = getSmartFallbackResponse(message, req.user);
        }

        // Add AI response to history
        userHistory.push({ role: 'assistant', content: aiResponse });

        res.json({
            success: true,
            reply: aiResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing your message',
            error: error.message
        });
    }
});

// @route   GET /api/chatbot/history
// @desc    Get chat history
// @access  Private
router.get('/history', protect, (req, res) => {
    const userId = req.user.id;
    const history = chatHistory.get(userId) || [];

    res.json({
        success: true,
        history: history.slice(-20)
    });
});

// @route   DELETE /api/chatbot/history
// @desc    Clear chat history
// @access  Private
router.delete('/history', protect, (req, res) => {
    const userId = req.user.id;
    chatHistory.delete(userId);

    res.json({
        success: true,
        message: 'Chat history cleared'
    });
});

// Smart fallback responses when AI is unavailable
function getSmartFallbackResponse(message, user) {
    const lowerMessage = message.toLowerCase();

    // Greeting responses
    if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
        return `Hello ${user.name}! 👋 How can I help you today with the Smart Attendance System?`;
    }

    // Attendance queries
    if (lowerMessage.includes('attendance') && (lowerMessage.includes('check') || lowerMessage.includes('view') || lowerMessage.includes('see'))) {
        return `To check your attendance:\n1. Go to your Dashboard\n2. Look at the "Subject Performance" section for subject-wise attendance\n3. For detailed reports, click on "Reports" in the navigation\n\nIs there anything specific you'd like to know about your attendance?`;
    }

    if (lowerMessage.includes('low attendance') || lowerMessage.includes('attendance shortage')) {
        return `If you have low attendance (below 75%):\n• You'll see a warning banner on your dashboard\n• Check the Reports section for subject-wise breakdown\n• Contact your faculty or HOD for condonation process\n• Make sure to attend all upcoming classes\n\nWould you like guidance on improving your attendance?`;
    }

    // Timetable queries
    if (lowerMessage.includes('timetable') || lowerMessage.includes('schedule') || lowerMessage.includes('class')) {
        return `You can view your timetable by:\n1. Clicking on "Timetable" in the navigation menu\n2. Today's schedule is also shown on your Dashboard\n\nThe timetable shows all your classes with timing, room, and subject details.`;
    }

    // Mark attendance
    if (lowerMessage.includes('mark') && lowerMessage.includes('attendance')) {
        if (user.role === 'student') {
            return `To mark your attendance:\n1. Go to Dashboard and find today's schedule\n2. Click "Mark" next to the current class\n3. Your location will be verified automatically\n4. Complete face verification\n5. Done! Your attendance is recorded.\n\n⚠️ Make sure you're within the campus geofence area.`;
        } else {
            return `To take attendance:\n1. Go to Dashboard\n2. Click "Take Attendance" for the current class\n3. Students will appear in the list\n4. Mark present/absent or use bulk actions\n5. Submit to save\n\nYou can also download attendance as CSV.`;
        }
    }

    // Technical issues
    if (lowerMessage.includes('not working') || lowerMessage.includes('error') || lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
        return `I'm sorry you're experiencing issues. Here are some troubleshooting steps:\n\n1. **Refresh the page** (Ctrl+F5)\n2. **Clear browser cache** and try again\n3. **Check your internet connection**\n4. **Try a different browser**\n5. **Make sure location services are enabled**\n\nIf the problem persists, please contact the admin with:\n- Screenshot of the error\n- Steps you took before the error\n- Browser and device info`;
    }

    // Password
    if (lowerMessage.includes('password') || lowerMessage.includes('forgot') || lowerMessage.includes('reset')) {
        return `For password issues:\n• **Forgot password**: Click "Forgot Password" on the login page\n• **Change password**: Go to Profile/Settings in your dashboard\n• **Default password**: New accounts use "College@123"\n\n⚠️ Always change the default password after first login!`;
    }

    // Notices
    if (lowerMessage.includes('notice') || lowerMessage.includes('announcement')) {
        return `To view notices:\n1. Click on "Notices" in the navigation\n2. Important notices also appear as notifications (bell icon)\n3. Notices are categorized by priority (Urgent, Normal)\n\nYou'll receive email notifications for important announcements.`;
    }

    // Help
    if (lowerMessage.includes('help') || lowerMessage.includes('how to') || lowerMessage.includes('guide')) {
        return `Here's what I can help you with:\n\n📊 **Attendance** - Check, mark, or understand attendance\n📅 **Timetable** - View your class schedule\n📢 **Notices** - Find announcements\n📈 **Reports** - Understand attendance reports\n🔧 **Technical Issues** - Troubleshoot problems\n🔑 **Account** - Password and profile help\n\nWhat would you like to know more about?`;
    }

    // Contact
    if (lowerMessage.includes('contact') || lowerMessage.includes('admin') || lowerMessage.includes('support')) {
        return `For further assistance:\n• **Email Admin**: admin@college.edu\n• **Technical Support**: support@smartattendance.com\n• **Phone**: Contact your department office\n\nFor urgent matters, visit the admin office during working hours.`;
    }

    // Thank you
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
        return `You're welcome, ${user.name}! 😊 Feel free to ask if you need any more help with the attendance system.`;
    }

    // Bye
    if (lowerMessage.match(/^(bye|goodbye|see you|take care)/)) {
        return `Goodbye, ${user.name}! Have a great day! 👋 Don't forget to mark your attendance!`;
    }

    // Default response
    return `I understand you're asking about "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n\nI'm here to help with:\n• Attendance queries\n• Timetable information\n• Technical support\n• Account assistance\n\nCould you please be more specific about what you need help with?`;
}

module.exports = router;
