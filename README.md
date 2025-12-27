# 🎓 Smart Attendance System

A WiFi-based geofencing attendance system with face verification for educational institutions.

## ✨ Features

### Student App
- 📱 Connect to classroom WiFi hotspot
- 📍 Location-based geofencing verification
- 👤 Face recognition for identity verification
- 📊 View attendance history and statistics
- 🔔 Real-time notifications

### Faculty App
- 📡 Create WiFi hotspot for attendance session
- 👥 Real-time student attendance monitoring
- ✏️ Manual attendance override capability
- 📈 Generate attendance reports
- 📢 Post notices and announcements

### Admin Panel
- 👤 User management (Students, Faculty)
- 📚 Subject and course management
- 📅 Timetable configuration
- ⚙️ Geofence settings
- 📊 System-wide analytics

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing

## 📁 Project Structure

```
TechSprint/
├── public/                   # Frontend files
│   ├── index.html           # Landing page
│   ├── assets/
│   │   ├── css/
│   │   │   └── style.css    # Global styles
│   │   └── js/
│   │       ├── api.js       # API service
│   │       ├── socket.js    # Socket.IO client
│   │       ├── utils.js     # Utility functions
│   │       ├── geolocation.js
│   │       └── face-verification.js
│   └── pages/
│       ├── student-login.html
│       ├── student-dashboard.html
│       ├── faculty-login.html
│       ├── faculty-dashboard.html
│       ├── admin-login.html
│       └── admin-dashboard.html
│
├── server/                   # Backend files
│   ├── server.js            # Main server entry
│   ├── seed.js              # Database seeder
│   ├── config/
│   │   ├── database.js      # MongoDB connection
│   │   └── constants.js     # App constants
│   ├── models/
│   │   ├── User.js
│   │   ├── Subject.js
│   │   ├── Timetable.js
│   │   ├── AttendanceSession.js
│   │   ├── AttendanceRecord.js
│   │   ├── Notice.js
│   │   └── WifiSession.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── attendance.js
│   │   ├── timetable.js
│   │   ├── subjects.js
│   │   ├── notices.js
│   │   ├── wifi.js
│   │   ├── face.js
│   │   └── admin.js
│   ├── socket.js            # Socket.IO handlers
│   └── uploads/             # File uploads
│
├── package.json
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sayan-dev731/TechSprint.git
   cd TechSprint
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

5. **Seed the database**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open http://localhost:3000 in your browser

## 🔐 Default Credentials

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartattendance.com | admin123 |
| Faculty | rajesh@smartattendance.com | faculty123 |
| Faculty | priya@smartattendance.com | faculty123 |
| Student | kshitij@student.edu | student123 |

## 📡 Attendance Flow

```
┌─────────────────┐
│  FACULTY APP    │
├─────────────────┤
│ 1. Start WiFi   │
│    Hotspot      │
│ 2. Create       │
│    Session      │
│ 3. Monitor      │
│    Real-time    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  STUDENT APP    │
├─────────────────┤
│ 1. Connect to   │
│    WiFi         │
│ 2. Verify       │
│    Location     │
│ 3. Face         │
│    Verification │
│ 4. Mark         │
│    Attendance   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CLOUD BACKEND   │
├─────────────────┤
│ • Validate IP   │
│ • Check Geofence│
│ • Verify Face   │
│ • Record        │
│   Attendance    │
│ • Real-time     │
│   Updates       │
└─────────────────┘
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile

### Attendance
- `POST /api/attendance/sessions` - Create attendance session
- `GET /api/attendance/sessions/active` - Get active sessions
- `POST /api/attendance/mark/:sessionId` - Mark attendance
- `POST /api/attendance/verify/geolocation` - Verify location
- `GET /api/attendance/my-history` - Get student's history

### WiFi
- `POST /api/wifi/sessions` - Create WiFi session
- `POST /api/wifi/verify` - Verify WiFi connection

### Face
- `POST /api/face/register` - Register face data
- `POST /api/face/verify` - Verify face

### Admin
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/smart-attendance |
| JWT_SECRET | JWT signing secret | (required) |
| JWT_EXPIRES_IN | Token expiration | 7d |
| DEFAULT_GEOFENCE_RADIUS | Geofence radius in meters | 50 |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.


## 🙏 Acknowledgments

- Bootstrap for UI components
- MongoDB for database
- Socket.IO for real-time communication
