// ===== Smart Attendance System - API Service =====

const API_BASE = '/api';

// Token Management
const TokenService = {
    get: () => localStorage.getItem('token'),
    set: (token) => localStorage.setItem('token', token),
    remove: () => localStorage.removeItem('token'),
    getUser: () => JSON.parse(localStorage.getItem('user') || 'null'),
    setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
    removeUser: () => localStorage.removeItem('user'),
    isLoggedIn: () => !!localStorage.getItem('token')
};

// HTTP Client
const httpClient = {
    async request(url, options = {}) {
        const token = TokenService.get();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    TokenService.remove();
                    TokenService.removeUser();
                    window.location.href = '/';
                }
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get: (url) => httpClient.request(url, { method: 'GET' }),
    post: (url, data) => httpClient.request(url, { method: 'POST', body: JSON.stringify(data) }),
    put: (url, data) => httpClient.request(url, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (url) => httpClient.request(url, { method: 'DELETE' })
};

// Auth API
const AuthAPI = {
    login: (credentials) => httpClient.post('/auth/login', credentials),
    register: (userData) => httpClient.post('/auth/register', userData),
    me: () => httpClient.get('/auth/me'),
    logout: () => httpClient.post('/auth/logout'),
    changePassword: (currentPassword, newPassword) =>
        httpClient.put('/auth/password', { currentPassword, newPassword }),
    forgotPassword: (email) => httpClient.post('/auth/forgot-password', { email })
};

// Attendance API
const AttendanceAPI = {
    startSession: (data) => httpClient.post('/attendance/session/start', data),
    endSession: (sessionId) => httpClient.post(`/attendance/session/${sessionId}/end`),
    getActiveSession: () => httpClient.get('/attendance/session/active'),
    verify: (data) => httpClient.post('/attendance/verify', data),
    manualOverride: (recordId, status, reason) =>
        httpClient.post('/attendance/manual-override', { recordId, status, reason }),
    getStudentHistory: (params) => httpClient.get(`/attendance/student/history?${new URLSearchParams(params)}`),
    getFacultyHistory: (params) => httpClient.get(`/attendance/faculty/history?${new URLSearchParams(params)}`),
    getSessionRecords: (sessionId) => httpClient.get(`/attendance/session/${sessionId}/records`),
    getActiveSessions: () => httpClient.get('/attendance/student/active-sessions')
};

// WiFi API
const WiFiAPI = {
    createHotspot: (data) => httpClient.post('/wifi/create-hotspot', data),
    connect: (data) => httpClient.post('/wifi/connect', data),
    getDevices: (sessionId) => httpClient.get(`/wifi/session/${sessionId}/devices`),
    endSession: (sessionId) => httpClient.post(`/wifi/session/${sessionId}/end`),
    getActiveSessions: () => httpClient.get('/wifi/active'),
    verifyIP: (wifiSessionId, ipAddress) => httpClient.post('/wifi/verify-ip', { wifiSessionId, ipAddress })
};

// Face API
const FaceAPI = {
    register: (faceData) => httpClient.post('/face/register', faceData),
    verify: (faceData) => httpClient.post('/face/verify', faceData),
    getStatus: () => httpClient.get('/face/status'),
    remove: () => httpClient.delete('/face/remove')
};

// Timetable API
const TimetableAPI = {
    get: (params) => httpClient.get(`/timetable?${new URLSearchParams(params)}`),
    getToday: () => httpClient.get('/timetable/today'),
    create: (data) => httpClient.post('/timetable', data),
    update: (id, data) => httpClient.put(`/timetable/${id}`, data),
    delete: (id) => httpClient.delete(`/timetable/${id}`),
    reschedule: (data) => httpClient.post('/timetable/reschedule', data)
};

// Subject API
const SubjectAPI = {
    getAll: (params) => httpClient.get(`/subjects?${new URLSearchParams(params)}`),
    get: (id) => httpClient.get(`/subjects/${id}`),
    create: (data) => httpClient.post('/subjects', data),
    update: (id, data) => httpClient.put(`/subjects/${id}`, data),
    assignFaculty: (id, facultyId) => httpClient.put(`/subjects/${id}/assign-faculty`, { facultyId }),
    delete: (id) => httpClient.delete(`/subjects/${id}`)
};

// Notice API
const NoticeAPI = {
    getAll: (params) => httpClient.get(`/notices?${new URLSearchParams(params)}`),
    get: (id) => httpClient.get(`/notices/${id}`),
    create: (data) => httpClient.post('/notices', data),
    update: (id, data) => httpClient.put(`/notices/${id}`, data),
    delete: (id) => httpClient.delete(`/notices/${id}`)
};

// User API
const UserAPI = {
    getAll: (params) => httpClient.get(`/users?${new URLSearchParams(params)}`),
    getStudents: (params) => httpClient.get(`/users/students?${new URLSearchParams(params)}`),
    getFaculty: (params) => httpClient.get(`/users/faculty?${new URLSearchParams(params)}`),
    get: (id) => httpClient.get(`/users/${id}`),
    update: (id, data) => httpClient.put(`/users/${id}`, data),
    toggleStatus: (id) => httpClient.put(`/users/${id}/toggle-status`),
    delete: (id) => httpClient.delete(`/users/${id}`)
};

// Admin API
const AdminAPI = {
    getDashboard: () => httpClient.get('/admin/dashboard'),
    getAttendanceReport: (params) => httpClient.get(`/admin/attendance-report?${new URLSearchParams(params)}`),
    updateGeofenceSettings: (data) => httpClient.put('/admin/settings/geofence', data),
    bulkRegister: (users, role) => httpClient.post('/admin/bulk-register', { users, role })
};

// Export all APIs
window.API = {
    Token: TokenService,
    Auth: AuthAPI,
    Attendance: AttendanceAPI,
    WiFi: WiFiAPI,
    Face: FaceAPI,
    Timetable: TimetableAPI,
    Subject: SubjectAPI,
    Notice: NoticeAPI,
    User: UserAPI,
    Admin: AdminAPI
};
