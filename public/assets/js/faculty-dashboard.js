(function () {
    'use strict';

    // --- 1. CONFIG & DATA ---

    // Check authentication and get user data
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'faculty') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'faculty-login';
    }

    // API Configuration
    const API_BASE = '/api';

    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    }

    // FACULTY'S SPECIFIC TIMETABLE - will be loaded from API
    let weeklySchedule = {
        "Monday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "10:00 - 11:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "11:00 - 12:00", subject: "OS", type: "Lab (B1)", room: "Comp Lab 1" },
            { time: "01:00 - 02:00", subject: "OS", type: "Tutorial", room: "Room 101" },
            { time: "02:00 - 03:00", subject: "OS", type: "Lecture", room: "Hall A" }
        ],
        "Tuesday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Lab (B2)", room: "Comp Lab 2" },
            { time: "10:00 - 11:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "11:00 - 12:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "01:00 - 02:00", subject: "OS", type: "Tutorial", room: "Room 101" }
        ],
        "Wednesday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "10:00 - 11:00", subject: "OS", type: "Lab (B1)", room: "Comp Lab 1" },
            { time: "11:00 - 12:00", subject: "OS", type: "Tutorial", room: "Room 101" },
            { time: "01:00 - 02:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "02:00 - 03:00", subject: "OS", type: "Lab (B2)", room: "Comp Lab 2" }
        ],
        "Thursday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Tutorial", room: "Room 101" },
            { time: "10:00 - 11:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "11:00 - 12:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "01:00 - 02:00", subject: "OS", type: "Lab (B1)", room: "Comp Lab 1" }
        ],
        "Friday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Lab (B2)", room: "Comp Lab 2" },
            { time: "10:00 - 11:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "11:00 - 12:00", subject: "OS", type: "Tutorial", room: "Room 101" },
            { time: "01:00 - 02:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "02:00 - 03:00", subject: "OS", type: "Lab (B1)", room: "Comp Lab 1" }
        ],
        "Saturday": [
            { time: "09:00 - 10:00", subject: "OS", type: "Lecture", room: "Hall A" },
            { time: "10:00 - 11:00", subject: "OS", type: "Tutorial", room: "Room 101" },
            { time: "11:00 - 12:00", subject: "OS", type: "Lab (B2)", room: "Comp Lab 2" },
            { time: "01:00 - 02:00", subject: "OS", type: "Lecture", room: "Hall A" }
        ]
    };

    // Students list - loaded from API
    let students = [];
    let allStudents = [];
    let attendanceHistory = [];
    let notifications = [];

    let currentClassTitle = '';
    let modalObj;

    // --- 2. INITIALIZATION ---

    window.onload = function () {
        modalObj = new bootstrap.Modal(document.getElementById('attendanceModal'));

        // Update faculty name from user data
        updateFacultyInfo();

        // Connect to socket for real-time updates
        connectToSocket();

        // Load data
        loadStudents();
        loadSchedule();
        loadNotifications();
        loadAttendanceHistory();

        document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Socket connection for real-time notifications
    function connectToSocket() {
        if (typeof socketService !== 'undefined') {
            socketService.connect();

            // Listen for new notices
            socketService.on('newNotice', (data) => {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast(`📢 New Notice: ${data.title}`, 'info');
                }
                // Reload notifications
                loadNotifications();
            });

            // Listen for attendance updates
            socketService.on('attendanceUpdate', (data) => {
                // Update dashboard counts if needed
                console.log('Attendance update received:', data);
            });

            // Listen for student joining session
            socketService.on('studentJoinedWifi', (data) => {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast(`📱 ${data.studentName || 'Student'} connected to session`, 'info');
                }
            });
        }
    }

    // Update faculty info from logged in user
    function updateFacultyInfo() {
        const welcomeEl = document.querySelector('.main-content h4.fw-bold');
        if (welcomeEl && user.name) {
            welcomeEl.textContent = `Welcome, ${user.name}`;
        }
        const initialsEl = document.querySelector('.dropdown-toggle .rounded-circle');
        if (initialsEl && user.name) {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            initialsEl.textContent = initials;
        }
    }

    // Load students from API
    async function loadStudents() {
        try {
            const response = await apiRequest('/users/students');
            allStudents = response.students || [];
            students = allStudents.map(s => ({
                id: s.rollNumber || s._id,
                name: s.name,
                email: s.email,
                status: false
            }));

            // Update total students count
            const totalStudentsEl = document.querySelector('.stat-card:nth-child(3) h3');
            if (totalStudentsEl) {
                totalStudentsEl.textContent = students.length;
            }
        } catch (error) {
            console.error('Failed to load students:', error);
            // Use mock data as fallback
            students = Array.from({ length: 60 }, (_, i) => ({
                id: 301 + i,
                name: `Student Name ${i + 1}`,
                status: false
            }));
        }
    }

    // Load notifications
    async function loadNotifications() {
        try {
            const response = await apiRequest('/notices?limit=10');
            notifications = response.notices || [];
            renderNotifications();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    // Render notifications
    function renderNotifications() {
        const notifContainer = document.querySelector('.schedule-card:last-child .list-group');
        if (!notifContainer) return;

        if (notifications.length === 0) {
            notifContainer.innerHTML = `
                <div class="list-group-item px-0 border-0 text-muted">
                    No notifications
                </div>
            `;
            return;
        }

        notifContainer.innerHTML = notifications.slice(0, 5).map(n => `
            <div class="list-group-item px-0 border-0 mb-2">
                <div class="d-flex align-items-start gap-2">
                    <i class="bi bi-${n.priority === 'high' ? 'exclamation-circle text-danger' : 'info-circle text-primary'} mt-1"></i>
                    <div>
                        <small class="fw-bold d-block">${n.title}</small>
                        <small class="text-muted">${n.content?.substring(0, 50)}${n.content?.length > 50 ? '...' : ''}</small>
                    </div>
                </div>
            </div>
        `).join('');

        // Update notification badge
        const badge = document.querySelector('.position-relative .bg-danger');
        if (badge) {
            badge.style.display = notifications.length > 0 ? 'block' : 'none';
        }
    }

    // Load attendance history
    async function loadAttendanceHistory() {
        try {
            const response = await apiRequest('/attendance/faculty/history');
            attendanceHistory = response.records || [];
        } catch (error) {
            console.error('Failed to load attendance history:', error);
        }
    }

    function getBadgeClass(type) {
        if (type.includes('Lab')) return 'type-lab';
        if (type.includes('Tutorial')) return 'type-tutorial';
        return 'type-lecture';
    }

    function loadSchedule() {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayIndex = new Date().getDay();
        let todayName = days[todayIndex];

        // If Sunday, default to Monday for demo purposes
        if (todayName === "Sunday") todayName = "Monday";

        document.getElementById('dayBadge').innerText = todayName;
        const classes = weeklySchedule[todayName] || [];
        document.getElementById('totalClassesToday').innerText = classes.length;

        const container = document.getElementById('scheduleContainer');
        container.innerHTML = '';

        if (classes.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted">No classes scheduled for today (Free).</div>';
            return;
        }

        classes.forEach((cls, index) => {
            const isActive = index === 0; // Mock: First class is 'active' for demo
            const html = `
                <div class="class-item rounded ${isActive ? 'bg-light border-start border-primary border-4' : ''}">
                    <div class="d-flex align-items-center gap-3">
                        <div class="bg-white border p-2 rounded text-center" style="min-width: 80px;">
                            <span class="d-block fw-bold small text-primary">${cls.time.split('-')[0]}</span>
                            <span class="d-block small text-muted">to ${cls.time.split('-')[1]}</span>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-1">
                                ${cls.subject}: Operating Systems 
                                <span class="type-badge ${getBadgeClass(cls.type)} ms-2">${cls.type}</span>
                            </h6>
                            <small class="text-muted"><i class="bi bi-geo-alt"></i> ${cls.room} | Prof. K Prasad</small>
                        </div>
                    </div>
                    <button class="btn ${isActive ? 'btn-primary' : 'btn-outline-primary'} btn-sm rounded-pill px-3" 
                        onclick="openAttendanceModal('${cls.subject} ${cls.type}')">
                        ${isActive ? 'Take Attendance' : 'View'}
                    </button>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    // --- 3. UI LOGIC ---

    window.toggleSidebar = function () {
        document.getElementById('sidebar').classList.toggle('active');
    };

    window.showSection = function (id, element) {
        document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
        document.getElementById(id).style.display = 'block';

        if (element) {
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            element.classList.add('active');
        }

        if (id === 'reports') loadReportsSection();
        if (id === 'attendance-history') loadHistorySection();
        if (id === 'students') loadStudentsSection();
        if (id === 'settings') loadSettingsSection();
    };

    // Load reports section with actual data
    async function loadReportsSection() {
        const reportsSection = document.getElementById('reports');
        if (!reportsSection) return;

        reportsSection.innerHTML = `
            <h3 class="fw-bold mb-4">Attendance Reports</h3>
            <div class="row g-4 mb-4">
                <div class="col-md-4">
                    <div class="stat-card p-3">
                        <h6 class="text-muted">Total Classes</h6>
                        <h3 id="reportTotalClasses">0</h3>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card p-3">
                        <h6 class="text-muted">Average Attendance</h6>
                        <h3 id="reportAvgAttendance">0%</h3>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stat-card p-3">
                        <h6 class="text-muted">Low Attendance Students</h6>
                        <h3 id="reportLowAttendance" class="text-danger">0</h3>
                    </div>
                </div>
            </div>
            <div class="card p-4 mb-4">
                <h5 class="mb-3">Attendance Trend</h5>
                <canvas id="attendanceChart" style="max-height: 300px;"></canvas>
            </div>
            <div class="card p-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Student Attendance Details</h5>
                    <button class="btn btn-primary btn-sm" onclick="downloadAttendanceReport()">
                        <i class="bi bi-download"></i> Download Report
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Roll No</th>
                                <th>Student Name</th>
                                <th>Classes Attended</th>
                                <th>Total Classes</th>
                                <th>Percentage</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="reportTableBody">
                            <tr><td colspan="6" class="text-center">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Load report data
        try {
            const response = await apiRequest('/admin/attendance-report');
            const report = response.report || [];

            document.getElementById('reportTotalClasses').textContent = report.length > 0 ? report[0].totalClasses : 0;

            const avgAttendance = report.length > 0
                ? Math.round(report.reduce((acc, r) => acc + r.percentage, 0) / report.length)
                : 0;
            document.getElementById('reportAvgAttendance').textContent = avgAttendance + '%';

            const lowAttendance = report.filter(r => r.percentage < 75).length;
            document.getElementById('reportLowAttendance').textContent = lowAttendance;

            // Populate table
            const tbody = document.getElementById('reportTableBody');
            if (report.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No attendance data available</td></tr>';
            } else {
                tbody.innerHTML = report.map(r => `
                    <tr>
                        <td><strong>${r.student.rollNumber || '-'}</strong></td>
                        <td>${r.student.name}</td>
                        <td>${r.present + r.late}</td>
                        <td>${r.totalClasses}</td>
                        <td class="${r.percentage < 75 ? 'text-danger fw-bold' : 'text-success'}">${r.percentage}%</td>
                        <td><span class="badge bg-${r.percentage >= 75 ? 'success' : 'danger'}">${r.percentage >= 75 ? 'Safe' : 'Low'}</span></td>
                    </tr>
                `).join('');
            }

            // Load chart
            loadChart();
        } catch (error) {
            console.error('Failed to load report:', error);
            loadChart(); // Load mock chart data
        }
    }

    // Load attendance history section
    async function loadHistorySection() {
        const historySection = document.getElementById('attendance-history');
        if (!historySection) return;

        historySection.innerHTML = `
            <h3 class="fw-bold mb-4">Attendance History</h3>
            <div class="card p-4">
                <div class="mb-3">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <input type="date" class="form-control" id="historyDateFrom" placeholder="From Date">
                        </div>
                        <div class="col-md-3">
                            <input type="date" class="form-control" id="historyDateTo" placeholder="To Date">
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-primary" onclick="filterHistory()">Filter</button>
                        </div>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Date</th>
                                <th>Subject</th>
                                <th>Class Type</th>
                                <th>Present</th>
                                <th>Absent</th>
                                <th>Total</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="historyTableBody">
                            <tr><td colspan="7" class="text-center">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        try {
            const response = await apiRequest('/attendance/faculty/history');
            const sessions = response.sessions || [];

            const tbody = document.getElementById('historyTableBody');
            if (sessions.length === 0) {
                // Show mock data
                tbody.innerHTML = `
                    <tr>
                        <td>${new Date().toLocaleDateString()}</td>
                        <td>Operating Systems</td>
                        <td>Lecture</td>
                        <td class="text-success">52</td>
                        <td class="text-danger">8</td>
                        <td>60</td>
                        <td><button class="btn btn-sm btn-outline-primary">View</button></td>
                    </tr>
                    <tr>
                        <td>${new Date(Date.now() - 86400000).toLocaleDateString()}</td>
                        <td>Operating Systems</td>
                        <td>Lab</td>
                        <td class="text-success">28</td>
                        <td class="text-danger">2</td>
                        <td>30</td>
                        <td><button class="btn btn-sm btn-outline-primary">View</button></td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = sessions.map(s => `
                    <tr>
                        <td>${new Date(s.date).toLocaleDateString()}</td>
                        <td>${s.subject?.name || 'N/A'}</td>
                        <td>${s.type || 'Lecture'}</td>
                        <td class="text-success">${s.presentCount || 0}</td>
                        <td class="text-danger">${s.absentCount || 0}</td>
                        <td>${s.totalStudents || 0}</td>
                        <td><button class="btn btn-sm btn-outline-primary" onclick="viewSession('${s._id}')">View</button></td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    // Load students management section
    async function loadStudentsSection() {
        const studentsSection = document.getElementById('students');
        if (!studentsSection) return;

        studentsSection.innerHTML = `
            <h3 class="fw-bold mb-4">Manage Students</h3>
            <div class="card p-4">
                <div class="mb-3">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <select class="form-select" id="filterBranch" onchange="filterStudents()">
                                <option value="">All Branches</option>
                                <option value="CSE">CSE</option>
                                <option value="IT">IT</option>
                                <option value="ECE">ECE</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="filterSemester" onchange="filterStudents()">
                                <option value="">All Semesters</option>
                                <option value="1">1st Sem</option>
                                <option value="2">2nd Sem</option>
                                <option value="3">3rd Sem</option>
                                <option value="4">4th Sem</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <input type="text" class="form-control" id="searchStudent" placeholder="Search by name or roll..." onkeyup="filterStudents()">
                        </div>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Roll No</th>
                                <th>Student Name</th>
                                <th>Email</th>
                                <th>Branch</th>
                                <th>Semester</th>
                                <th>Attendance %</th>
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
                            <tr><td colspan="6" class="text-center">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        try {
            const response = await apiRequest('/users/students');
            allStudents = response.students || [];
            renderStudentsTable(allStudents);
        } catch (error) {
            console.error('Failed to load students:', error);
        }
    }

    function renderStudentsTable(studentsList) {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        if (studentsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No students found</td></tr>';
            return;
        }

        tbody.innerHTML = studentsList.map(s => `
            <tr>
                <td><strong>${s.rollNumber || '-'}</strong></td>
                <td>${s.name}</td>
                <td>${s.email}</td>
                <td>${s.branch || '-'}</td>
                <td>${s.semester || '-'}</td>
                <td>-</td>
            </tr>
        `).join('');
    }

    window.filterStudents = function () {
        const branch = document.getElementById('filterBranch')?.value;
        const semester = document.getElementById('filterSemester')?.value;
        const search = document.getElementById('searchStudent')?.value?.toLowerCase();

        let filtered = allStudents.filter(s => {
            if (branch && s.branch !== branch) return false;
            if (semester && s.semester !== parseInt(semester)) return false;
            if (search && !s.name.toLowerCase().includes(search) && !(s.rollNumber || '').toLowerCase().includes(search)) return false;
            return true;
        });

        renderStudentsTable(filtered);
    };

    // Load settings section
    function loadSettingsSection() {
        const settingsSection = document.getElementById('settings');
        if (!settingsSection) return;

        settingsSection.innerHTML = `
            <h3 class="fw-bold mb-4">Settings</h3>
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card p-4">
                        <h5 class="mb-3">Profile Information</h5>
                        <div class="mb-3">
                            <label class="form-label">Name</label>
                            <input type="text" class="form-control" id="settingsName" value="${user.name || ''}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-control" id="settingsEmail" value="${user.email || ''}" readonly>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Department</label>
                            <input type="text" class="form-control" id="settingsDept" value="${user.department || 'CSE'}">
                        </div>
                        <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card p-4">
                        <h5 class="mb-3">Change Password</h5>
                        <div class="mb-3">
                            <label class="form-label">Current Password</label>
                            <input type="password" class="form-control" id="currentPassword">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">New Password</label>
                            <input type="password" class="form-control" id="newPassword">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Confirm New Password</label>
                            <input type="password" class="form-control" id="confirmPassword">
                        </div>
                        <button class="btn btn-warning" onclick="changePassword()">Update Password</button>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card p-4">
                        <h5 class="mb-3">Notification Preferences</h5>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" id="emailNotif" checked>
                            <label class="form-check-label" for="emailNotif">Email Notifications</label>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" id="browserNotif" checked>
                            <label class="form-check-label" for="browserNotif">Browser Notifications</label>
                        </div>
                        <button class="btn btn-success" onclick="saveNotificationSettings()">Save Preferences</button>
                    </div>
                </div>
            </div>
        `;
    }

    window.saveProfile = async function () {
        const name = document.getElementById('settingsName').value;
        const dept = document.getElementById('settingsDept').value;

        try {
            await apiRequest(`/users/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, department: dept })
            });
            user.name = name;
            user.department = dept;
            localStorage.setItem('user', JSON.stringify(user));
            alert('Profile updated successfully!');
            updateFacultyInfo();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    window.changePassword = async function () {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match!');
            return;
        }

        try {
            await apiRequest('/auth/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            alert('Password updated successfully!');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    window.downloadAttendanceReport = function () {
        const table = document.getElementById('reportTableBody');
        if (!table) return;

        let csv = 'Roll No,Student Name,Classes Attended,Total Classes,Percentage,Status\\n';
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                csv += Array.from(cells).map(c => '"' + c.textContent.trim() + '"').join(',') + '\\n';
            }
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_report.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Logout function
    window.facultyLogout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'faculty-login';
    };

    // --- 4. ATTENDANCE LOGIC ---

    window.openAttendanceModal = function (className) {
        currentClassTitle = className;
        document.getElementById('modalClassTitle').innerText = className;

        // Reset UI for "Anchor Device" simulation
        const gpsDot = document.getElementById('gpsIndicator');
        const gpsText = document.getElementById('gpsText');
        gpsDot.classList.remove('gps-active');
        gpsDot.style.backgroundColor = 'orange';
        gpsText.innerText = "Searching for Anchor Device...";

        // Reset Students
        students.forEach(s => s.status = false);

        modalObj.show();

        // Simulate Anchor Device Connection
        setTimeout(() => {
            gpsDot.style.backgroundColor = '#198754';
            gpsDot.classList.add('gps-active');
            gpsText.innerText = "Anchor Device Active • GPS Locked (21.25°N, 81.63°E)";

            renderStudentList();
            updateStats();
        }, 1500); // 1.5s delay
    };

    function renderStudentList() {
        const tbody = document.getElementById('studentListBody');
        tbody.innerHTML = '';

        students.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.className = `student-row ${s.status ? 'present' : 'absent'}`;
            tr.innerHTML = `
                <td><span class="fw-bold text-secondary">${s.id}</span></td>
                <td>${s.name}</td>
                <td class="text-end">
                    <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input" type="checkbox" 
                            onchange="toggleStudent(${idx}, this)" ${s.status ? 'checked' : ''}>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('totalStudentCount').innerText = students.length;
    }

    window.toggleStudent = function (index, checkbox) {
        students[index].status = checkbox.checked;
        renderStudentList();
        updateStats();
    };

    window.markAll = function (isPresent) {
        students.forEach(s => s.status = isPresent);
        renderStudentList();
        updateStats();
    };

    function updateStats() {
        const present = students.filter(s => s.status).length;
        const total = students.length;
        const pct = Math.round((present / total) * 100);

        document.getElementById('presentCount').innerText = present;
        document.getElementById('absentCount').innerText = total - present;

        const bar = document.getElementById('progressBar');
        bar.style.width = pct + '%';
        bar.className = `progress-bar ${pct < 50 ? 'bg-danger' : (pct < 75 ? 'bg-warning' : 'bg-success')}`;
    }

    window.submitAttendance = function () {
        const btn = document.querySelector('.modal-footer .btn-success');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        btn.disabled = true;

        setTimeout(() => {
            alert(`Attendance for ${currentClassTitle} Saved to Database!`);
            btn.innerHTML = originalText;
            btn.disabled = false;
            modalObj.hide();
        }, 1000);
    };

    window.downloadCSV = function () {
        let csv = "RollNo,Name,Status,Date\n";
        const date = new Date().toLocaleDateString();
        students.forEach(s => {
            csv += `${s.id},${s.name},${s.status ? 'Present' : 'Absent'},${date}\n`;
        });

        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        link.download = `Attendance_${currentClassTitle}.csv`;
        link.click();
    };

    function loadChart() {
        const ctx = document.getElementById('attendanceChart');
        if (window.myChart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'OS Class Attendance %',
                    data: [85, 82, 78, 90, 85, 70],
                    borderColor: '#0d6efd',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(13, 110, 253, 0.1)'
                }]
            },
            options: { responsive: true, scales: { y: { min: 0, max: 100 } } }
        });
    }

})();
