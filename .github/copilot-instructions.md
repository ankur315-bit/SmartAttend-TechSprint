# TechSprint - AI Coding Agent Instructions

## Project Overview
**TechSprint** is a WiFi-based geofencing attendance system with face verification for educational institutions. It's a role-based full-stack application with Express backend, MongoDB database, and vanilla JavaScript frontend using Socket.IO for real-time updates.

## Architecture Overview

### High-Level Data Flow
1. **Authentication Flow**: JWT tokens stored in localStorage → Bearer tokens in API headers → Server verifies via `protect` middleware
2. **Real-time Updates**: Socket.IO rooms organize communication (user-specific: `user_${userId}`, session-specific: `session_${sessionId}`)
3. **Attendance Process**: Faculty creates WiFi hotspot → Students connect → Geolocation verification → Face verification → Attendance marked

### Core Components

**Backend Structure** (`server/`):
- **Models**: Define MongoDB schemas with role-specific fields (Student: rollNumber/batch; Faculty: employeeId/department)
- **Middleware**: Auth flow via `protect` + role-based `authorize(...roles)` pattern
- **Routes**: RESTful endpoints grouped by feature (auth, attendance, timetable, etc.)
- **Socket.IO** (`socket.js`): Real-time attendance verification events using room-based broadcasting
- **Services**: Email service injected globally as `global.EmailService`

**Frontend Architecture** (`public/`):
- **API Client** (`assets/js/api.js`): Centralized HTTP client with automatic token handling and auth redirects
- **Token Management**: TokenService handles localStorage persistence + logout redirects
- **Socket Integration** (`assets/js/socket.js`): Connects with JWT auth token from handshake

### Key Integration Points
- **Environment Variables** (`process.env.MONGODB_URI`, `JWT_SECRET`): Critical for DB/auth configuration
- **Global Services**: EmailService attached to `global` in `server.js` for access across routes
- **Express App Instance**: Socket.IO (io) stored in `app.set('io', io)` for route access via `req.app.get('io')`
- **File Uploads**: Multer middleware in `middleware/upload.js`; uploads stored in `uploads/` directory with public serving configured

## Development Commands

```bash
npm run dev       # Start with nodemon (development)
npm start         # Production server
npm run seed      # Initialize/reset database with sample data
npm test          # Test runner (currently not implemented)
```

**Critical Note**: The last command in terminal (`npn run dev`) had typo exit code 1 - ensure `npm` not `npn`.

## Project Conventions & Patterns

### Authentication & Authorization
- **Pattern**: `exports.protect` middleware + `exports.authorize(...roles)` composition
- **Token Generation**: Simple JWT signing in route handlers via `generateToken(id)`
- **User Context**: Verified user attached to `req.user` after middleware
- **Role Enum**: Stored in `constants.js` as `ROLES = { ADMIN, FACULTY, STUDENT }`
- **Special Checks**: Deactivated users blocked even with valid token (`!user.isActive`)

Example (from `routes/auth.js`):
```javascript
// Protect + authorize combination
router.get('/students', protect, authorize(ROLES.ADMIN, ROLES.FACULTY), handler);
```

### Database & Models
- **Framework**: Mongoose with schema validation
- **Convention**: Role-specific fields marked `sparse: true` (e.g., `rollNumber` only for students)
- **Methods**: Models include helper methods like `getProfile()` for sanitized output
- **User Schema**: Supports three roles with different field sets; all users have: name, email, password, role, isActive

### Real-Time Communication
- **Socket.IO Rooms**: Organize by entity (user_${id}, session_${id})
- **Auth Pattern**: JWT verified in io.use() middleware before connection
- **Broadcast Style**: Role-based (faculty announces hotspotStarted → all users receive; session-specific events use `io.to()`)
- **Common Events**: `joinSession`, `studentConnected`, `locationVerified`, `faceVerificationStarted`, `hotspotStarted`

### API Response Format
- **Standard Shape**: `{ success: boolean, message: string, token?: string, user?: object, data?: any }`
- **Error Handling**: Errors include message field for client display; 401 redirects user; 403 for role violations
- **Status Codes**: 201 for creation, 400 for validation, 401 for auth, 403 for authorization, 500 for server errors

### Constants & Configuration
All app constants in `server/config/constants.js`:
- JWT expiry: `7d`
- Geofence radius: `50 meters`
- Late threshold: `15 minutes` after session start
- Face match threshold: `0.6` (60% similarity)

## Common Tasks & Workflows

### Adding a New Feature Route
1. Create model in `server/models/` if needed
2. Add route file in `server/routes/` with pattern: `router.get/post/put/delete(path, protect, authorize(...), handler)`
3. Import route in `server.js` and register: `app.use('/api/feature', require('./routes/feature'))`
4. For real-time updates, emit Socket.IO events from route handlers via `req.app.get('io').to(roomName).emit(event, data)`

### Adding Real-Time Event
1. Define event listener in `server/socket.js` socket.on() block
2. Client emits via Socket.IO instance (initialized in `public/assets/js/socket.js`)
3. Broadcast response using `io.to(roomName).emit()` or `io.emit()` for all users

### Modifying User Roles/Fields
1. Update enum in `server/config/constants.js` ROLES object
2. Update User schema in `server/models/User.js` with new fields (mark sparse if role-specific)
3. Update registration logic in `routes/auth.js` to handle new role fields
4. Update middleware in `middleware/auth.js` if new permission checks needed

## File Organization & Key Files

| Path | Purpose |
|------|---------|
| `server/config/constants.js` | Central config; add new constants here |
| `server/middleware/auth.js` | Auth/authorization logic; extend with new role checks |
| `server/models/User.js` | User schema; primary source for field definitions |
| `server/socket.js` | Real-time event handlers; add new events here |
| `public/assets/js/api.js` | Client HTTP client; centralized API access |
| `public/assets/js/socket.js` | Client Socket.IO setup |

## Error Handling & Debugging

- **Middleware Order Matters**: `protect` must execute before `authorize` checks
- **Token Validation**: JWT errors silently 401 - check console and token validity
- **Socket Auth Failures**: Non-authenticated sockets get `Authentication error`; verify token in client handshake
- **Email Service**: Wrapped in try-catch to prevent registration failures if email fails; check `global.EmailService` availability
- **CORS**: Configured to allow all origins - restrict in production to specific frontend domain

## Dependencies & External Integrations

- **MongoDB**: Connection required via `MONGODB_URI` env var or defaults to localhost:27017
- **Google Generative AI** (`@google/generative-ai`): Used in chatbot route; requires API key
- **Socket.IO**: CORS open to all in development - restrict for production
- **Nodemailer**: Email service depends on SMTP configuration in `.env`
