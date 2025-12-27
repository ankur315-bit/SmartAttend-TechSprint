(function () {
    'use strict';

    // --- 1. CONFIG & DATA ---

    // Check authentication and get user data
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'faculty') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
        return;
    }

    // API Configuration
    const API_BASE = '/api';

    async function apiRequest(endpoint, options = {}) {
        try {
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
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Data stores
    let weeklySchedule = {};
    let students = [];
    let allStudents = [];
    let notifications = [];
    let attendanceHistory = [];
    let currentClassTitle = '';
    let currentSessionId = null;
    let attendanceModalObj = null;
    let quickAttendanceModalObj = null;
    let myAttendanceChart = null;
    let myReportChart = null;

    // --- 2. INITIALIZATION ---

    window.onload = function () {
        // Initialize Bootstrap modals (with defensive checks)
        const attendanceModalEl = document.getElementById('attendanceModal');
        const quickAttendanceModalEl = document.getElementById('quickAttendanceModal');

        if (attendanceModalEl) {
            attendanceModalObj = new bootstrap.Modal(attendanceModalEl);
        }
        if (quickAttendanceModalEl) {
            quickAttendanceModalObj = new bootstrap.Modal(quickAttendanceModalEl);
        }

        // Update faculty name from user data
        updateFacultyInfo();

        // Set current date display
        updateDateDisplay();

        // Connect to socket for real-time updates
        connectToSocket();

        // Load all data
        loadDashboardData();

        // Setup navigation
        setupNavigation();

        // Setup notification dropdown
        setupNotificationDropdown();

        // Setup form handlers
        setupFormHandlers();
    };

    // --- 3. DATA LOADING ---

    async function loadDashboardData() {
        try {
            await Promise.all([
                loadStudents(),
                loadTodaySchedule(),
                loadNotifications(),
                loadAttendanceStats()
            ]);

            // Load chart after data is ready
            loadAttendanceChart();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showToast('Error loading dashboard data', 'error');
        }
    }

    function updateFacultyInfo() {
        const facultyNameEl = document.getElementById('facultyName');
        const profileImage = document.getElementById('profileImage');

        if (facultyNameEl && user.name) {
            facultyNameEl.textContent = user.name;
        }

        if (profileImage && user.name) {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            profileImage.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=8B7FD8&color=fff&bold=true`;
        }

        // Update profile form if exists
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profilePhone = document.getElementById('profilePhone');
        const profileDept = document.getElementById('profileDept');

        if (profileName) profileName.value = user.name || '';
        if (profileEmail) profileEmail.value = user.email || '';
        if (profilePhone) profilePhone.value = user.phone || '';
        if (profileDept) profileDept.value = user.department || 'CSE';
    }

    function updateDateDisplay() {
        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    // Socket connection for real-time updates
    function connectToSocket() {
        if (typeof socketService !== 'undefined') {
            socketService.connect();

            socketService.on('newNotice', (data) => {
                showToast(`📢 New Notice: ${data.title}`, 'info');
                loadNotifications();
            });

            socketService.on('attendanceUpdate', (data) => {
                console.log('Attendance update received:', data);
            });

            socketService.on('studentJoinedWifi', (data) => {
                showToast(`📱 ${data.studentName || 'Student'} connected to session`, 'info');
            });
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
                branch: s.branch,
                semester: s.semester,
                batch: s.batch,
                status: false
            }));

            // Update total students count
            const totalStudentsEl = document.getElementById('totalStudents');
            if (totalStudentsEl) {
                totalStudentsEl.textContent = students.length;
            }

            // Populate batch filter
            populateBatchFilter();
        } catch (error) {
            console.error('Failed to load students:', error);
            // Use mock data as fallback
            students = Array.from({ length: 60 }, (_, i) => ({
                id: `2023CSE${String(i + 1).padStart(3, '0')}`,
                name: `Student Name ${i + 1}`,
                email: `student${i + 1}@college.edu`,
                branch: 'CSE',
                semester: 5,
                status: false
            }));
        }
    }

    function populateBatchFilter() {
        const filterBatch = document.getElementById('filterBatch');
        if (!filterBatch) return;

        const batches = [...new Set(allStudents.map(s => s.batch).filter(Boolean))];
        filterBatch.innerHTML = '<option value="">All Batches</option>';
        batches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            filterBatch.appendChild(option);
        });
    }

    // Load today's schedule
    async function loadTodaySchedule() {
        try {
            const response = await apiRequest('/timetable/today');
            const schedule = response.schedule || [];

            // Update day badge
            const dayBadge = document.getElementById('dayBadge');
            if (dayBadge) {
                dayBadge.textContent = response.day ? response.day.charAt(0).toUpperCase() + response.day.slice(1) : 'Today';
            }

            // Update total classes today
            const totalClassesToday = document.getElementById('totalClassesToday');
            if (totalClassesToday) {
                totalClassesToday.textContent = schedule.length;
            }

            // Update pending sessions
            const pendingEl = document.getElementById('pendingSessions');
            if (pendingEl) {
                pendingEl.textContent = schedule.length;
            }

            // Render schedule
            renderSchedule(schedule);

            // Populate quick attendance dropdown
            populateQuickAttendanceDropdown(schedule);

            return schedule;
        } catch (error) {
            console.error('Failed to load schedule:', error);
            renderMockSchedule();
        }
    }

    function renderSchedule(schedule) {
        const container = document.getElementById('scheduleContainer');
        if (!container) return;

        if (schedule.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4">
                    <i class="bi bi-calendar-x fs-1 text-muted mb-3 d-block"></i>
                    <p class="text-muted">No classes scheduled for today</p>
                </div>
            `;
            return;
        }

        container.innerHTML = schedule.map((cls, index) => {
            const isActive = index === 0;
            const badgeClass = getTypeBadgeClass(cls.type || cls.subject?.type || 'Lecture');
            const startTime = cls.startTime || '09:00';
            const endTime = cls.endTime || '10:00';
            const subjectName = cls.subject?.name || cls.subjectName || 'Subject';
            const room = cls.room || 'Room TBD';

            return `
                <div class="class-item ${isActive ? 'active-class' : ''}">
                    <div class="class-info">
                        <div class="class-time-box">
                            <span class="start-time">${formatTime(startTime)}</span>
                            <span class="end-time">to ${formatTime(endTime)}</span>
                        </div>
                        <div class="class-details">
                            <h6>${subjectName} <span class="type-badge ${badgeClass}">${cls.type || 'Lecture'}</span></h6>
                            <small><i class="bi bi-geo-alt"></i> ${room}</small>
                        </div>
                    </div>
                    <button class="btn ${isActive ? 'btn-primary' : 'btn-outline-primary'} btn-sm" 
                        onclick="openAttendanceModal('${subjectName} ${cls.type || 'Lecture'}', '${cls._id || ''}')">
                        ${isActive ? '<i class="bi bi-qr-code-scan me-1"></i> Take Attendance' : 'View'}
                    </button>
                </div>
            `;
        }).join('');
    }

    function renderMockSchedule() {
        const mockSchedule = [
            { startTime: '09:00', endTime: '10:00', subject: { name: 'Operating Systems' }, type: 'Lecture', room: 'Hall A' },
            { startTime: '10:00', endTime: '11:00', subject: { name: 'Operating Systems' }, type: 'Lab', room: 'Lab 1' },
            { startTime: '11:00', endTime: '12:00', subject: { name: 'Operating Systems' }, type: 'Tutorial', room: 'Room 101' }
        ];

        const dayBadge = document.getElementById('dayBadge');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (dayBadge) {
            dayBadge.textContent = days[new Date().getDay()];
        }

        const totalClassesToday = document.getElementById('totalClassesToday');
        if (totalClassesToday) {
            totalClassesToday.textContent = mockSchedule.length;
        }

        renderSchedule(mockSchedule);
    }

    function populateQuickAttendanceDropdown(schedule) {
        const select = document.getElementById('quickClassSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Select a class...</option>';
        schedule.forEach((cls, index) => {
            const option = document.createElement('option');
            option.value = cls._id || index;
            option.textContent = `${cls.subject?.name || 'Subject'} - ${cls.type || 'Lecture'} (${formatTime(cls.startTime)})`;
            select.appendChild(option);
        });
    }

    // Load notifications
    async function loadNotifications() {
        try {
            const response = await apiRequest('/notices?limit=10');
            notifications = response.notices || [];
            renderNotifications();
            renderNoticesCard();
            renderRecentActivity();
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    function renderNotifications() {
        const notifList = document.getElementById('notificationList');
        const badge = document.querySelector('.notification-badge');

        if (!notifList) return;

        if (notifications.length === 0) {
            notifList.innerHTML = `
                <div class="dropdown-item text-center text-muted">
                    No notifications
                </div>
            `;
            if (badge) badge.style.display = 'none';
            return;
        }

        notifList.innerHTML = notifications.slice(0, 5).map(n => `
            <div class="dropdown-item">
                <div class="d-flex align-items-start gap-2">
                    <i class="bi bi-${n.priority === 'high' ? 'exclamation-circle text-danger' : 'info-circle text-primary'} mt-1"></i>
                    <div>
                        <div class="fw-bold small">${n.title}</div>
                        <small class="text-muted">${n.content?.substring(0, 50)}${n.content?.length > 50 ? '...' : ''}</small>
                        <div class="text-muted" style="font-size: 11px;">${formatTimeAgo(n.createdAt)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        if (badge) {
            badge.textContent = notifications.length;
            badge.style.display = notifications.length > 0 ? 'flex' : 'none';
        }
    }

    function renderNoticesCard() {
        const container = document.getElementById('noticesContainer');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="event-item">
                    <div class="event-date">
                        <span class="day">--</span>
                        <span class="month">---</span>
                    </div>
                    <div class="event-details">
                        <div class="event-title">No notices</div>
                        <div class="event-time">Check back later</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.slice(0, 3).map(n => {
            const date = new Date(n.createdAt);
            return `
                <div class="event-item">
                    <div class="event-date">
                        <span class="day">${date.getDate()}</span>
                        <span class="month">${date.toLocaleString('en', { month: 'short' }).toUpperCase()}</span>
                    </div>
                    <div class="event-details">
                        <div class="event-title">${n.title}</div>
                        <div class="event-time">${n.priority === 'high' ? '🔴 Urgent' : '📢 Notice'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRecentActivity() {
        const container = document.getElementById('recentActivityList');
        if (!container) return;

        const activities = notifications.slice(0, 4).map(n => ({
            icon: n.priority === 'high' ? 'exclamation-circle' : 'megaphone',
            title: n.title,
            time: formatTimeAgo(n.createdAt)
        }));

        if (activities.length === 0) {
            container.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="bi bi-clock-history"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">No recent activity</div>
                        <div class="activity-time">Check back later</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="bi bi-${a.icon}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">${a.title}</div>
                    <div class="activity-time">${a.time}</div>
                </div>
            </div>
        `).join('');
    }

    // Load attendance statistics
    async function loadAttendanceStats() {
        try {
            const response = await apiRequest('/attendance/faculty/stats');
            const stats = response.stats || {};

            // Update dashboard stats
            const avgAttendance = document.getElementById('avgAttendance');
            const attendanceBar = document.getElementById('attendanceProgressBar');
            const sessionsToday = document.getElementById('sessionsToday');

            if (avgAttendance) {
                avgAttendance.textContent = `${stats.averageAttendance || 92}%`;
            }
            if (attendanceBar) {
                attendanceBar.style.width = `${stats.averageAttendance || 92}%`;
            }
            if (sessionsToday) {
                sessionsToday.textContent = stats.sessionsToday || 0;
            }
        } catch (error) {
            console.error('Failed to load attendance stats:', error);
        }
    }

    // Load attendance chart
    function loadAttendanceChart() {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) return;

        if (myAttendanceChart) {
            myAttendanceChart.destroy();
        }

        const timeRange = document.getElementById('chartTimeRange')?.value || 'week';
        const labels = timeRange === 'week'
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

        const data = timeRange === 'week'
            ? [85, 82, 78, 90, 85, 70]
            : [82, 85, 88, 86];

        myAttendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance %',
                    data: data,
                    borderColor: '#8B7FD8',
                    backgroundColor: 'rgba(139, 127, 216, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#8B7FD8',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    }

    // --- 4. NAVIGATION ---

    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSection = item.getAttribute('data-section');
                showSection(targetSection);
            });
        });

        // Handle URL hash on page load
        const hash = window.location.hash.substring(1); // Remove #
        if (hash && document.getElementById(hash)) {
            showSection(hash);
        }

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash.substring(1);
            if (newHash && document.getElementById(newHash)) {
                showSection(newHash);
            }
        });
    }

    // Helper function to show a section
    function showSection(sectionId) {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.page-section');

        // Update URL hash
        window.location.hash = sectionId;

        // Update active nav item
        navItems.forEach(nav => {
            const navSection = nav.getAttribute('data-section');
            if (navSection === sectionId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        // Show target section
        sections.forEach(section => section.classList.remove('active'));
        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.add('active');
        }

        // Load section-specific data
        if (sectionId === 'students-section') loadStudentsSection();
        if (sectionId === 'reports-section') loadReportsSection();
        if (sectionId === 'schedule-section') loadWeeklySchedule();
    }

    // Navigate to section helper
    window.navigateToSection = function (sectionId) {
        showSection(sectionId);
    };

    function setupNotificationDropdown() {
        const notifBell = document.querySelector('.notification-bell');
        if (notifBell) {
            notifBell.addEventListener('click', function (e) {
                e.stopPropagation();
                const dropdown = document.getElementById('notificationDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('show');
                }
            });

            document.addEventListener('click', function () {
                const dropdown = document.getElementById('notificationDropdown');
                if (dropdown) {
                    dropdown.classList.remove('show');
                }
            });
        }
    }

    // --- 5. SECTION LOADERS ---

    async function loadStudentsSection() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Loading students...</td></tr>';

        try {
            if (allStudents.length === 0) {
                await loadStudents();
            }

            // Fetch attendance stats for each student (like admin panel)
            const studentPromises = allStudents.map(async (student) => {
                try {
                    const attendanceResponse = await apiRequest(`/attendance/student/${student._id}/report`);
                    const data = attendanceResponse.report || {};

                    // Calculate overall percentage
                    if (data.subjects && data.subjects.length > 0) {
                        let totalClasses = 0, totalAttended = 0;
                        data.subjects.forEach(s => {
                            totalClasses += s.total || 0;
                            totalAttended += (s.present || 0) + (s.late || 0);
                        });
                        student.attendancePercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
                        student.totalClasses = totalClasses;
                        student.totalAttended = totalAttended;
                    } else {
                        student.attendancePercentage = 0;
                    }
                } catch (error) {
                    console.warn(`Failed to load attendance for student ${student.name}:`, error);
                    student.attendancePercentage = 0;
                }
            });

            // Wait for all attendance data to load
            await Promise.all(studentPromises);

            renderStudentsTable(allStudents);
            loadLowAttendanceAlerts();
        } catch (error) {
            console.error('Failed to load students section:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load students</td></tr>';
        }
    }

    function renderStudentsTable(studentsList) {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        if (studentsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No students found</td></tr>';
            return;
        }

        tbody.innerHTML = studentsList.map(s => {
            const percentage = s.attendancePercentage || 0;
            const colorClass = percentage >= 75 ? 'success' : percentage >= 60 ? 'warning' : 'danger';

            return `
                <tr>
                    <td><strong>${s.rollNumber || s.id || '-'}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.email || '-'}</td>
                    <td>${s.branch || '-'}</td>
                    <td>${s.semester || '-'}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="progress" style="width: 60px; height: 8px;">
                                <div class="progress-bar bg-${colorClass}" style="width: ${percentage}%"></div>
                            </div>
                            <span class="badge bg-${colorClass}">${percentage}%</span>
                        </div>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="viewStudentDetails('${s._id || s.id}')" title="View Details">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="viewStudentAttendance('${s._id || s.id}')" title="View Attendance">
                                <i class="bi bi-calendar-check"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.filterStudents = function () {
        const batch = document.getElementById('filterBatch')?.value;
        const search = document.getElementById('searchStudent')?.value?.toLowerCase();

        let filtered = allStudents.filter(s => {
            if (batch && s.batch !== batch) return false;
            if (search && !s.name.toLowerCase().includes(search) && !(s.rollNumber || '').toLowerCase().includes(search)) return false;
            return true;
        });

        renderStudentsTable(filtered);
    };

    async function loadLowAttendanceAlerts() {
        const container = document.getElementById('lowAttendanceContainer');
        if (!container) return;

        // Filter students with low attendance
        const lowAttendance = allStudents.filter(s => (s.attendancePercentage || 85) < 75);

        if (lowAttendance.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4 text-success">
                    <i class="bi bi-check-circle fs-1 mb-2 d-block"></i>
                    <p>All students have attendance above 75%</p>
                </div>
            `;
            return;
        }

        container.innerHTML = lowAttendance.slice(0, 5).map(s => `
            <div class="alert-item">
                <div class="student-info">
                    <div class="student-name">${s.name}</div>
                    <div class="student-roll">${s.rollNumber || s._id}</div>
                </div>
                <div class="attendance-percentage">${s.attendancePercentage || 65}%</div>
            </div>
        `).join('');
    }

    async function loadReportsSection() {
        try {
            const response = await apiRequest('/attendance/faculty/report');
            const report = response.report || [];

            // Update summary stats
            document.getElementById('reportTotalClasses').textContent = report.totalClasses || 0;
            document.getElementById('reportAvgAttendance').textContent = `${report.averageAttendance || 0}%`;
            document.getElementById('reportLowAttendance').textContent = report.lowAttendanceCount || 0;
            document.getElementById('reportSessionsMonth').textContent = report.sessionsThisMonth || 0;

            // Render report table
            renderReportTable(report.students || []);

            // Load report chart
            loadReportChart();
        } catch (error) {
            console.error('Failed to load reports:', error);
            // Load mock data
            renderMockReports();
        }
    }

    function renderReportTable(students) {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No report data available</td></tr>';
            return;
        }

        tbody.innerHTML = students.map(s => `
            <tr>
                <td><strong>${s.rollNumber || '-'}</strong></td>
                <td>${s.name}</td>
                <td>${s.attended || 0}</td>
                <td>${s.total || 0}</td>
                <td class="${s.percentage < 75 ? 'text-danger fw-bold' : 'text-success'}">${s.percentage || 0}%</td>
                <td><span class="badge bg-${s.percentage >= 75 ? 'success' : 'danger'}">${s.percentage >= 75 ? 'Safe' : 'Low'}</span></td>
            </tr>
        `).join('');
    }

    function renderMockReports() {
        document.getElementById('reportTotalClasses').textContent = '45';
        document.getElementById('reportAvgAttendance').textContent = '87%';
        document.getElementById('reportLowAttendance').textContent = '5';
        document.getElementById('reportSessionsMonth').textContent = '18';

        const mockStudents = allStudents.slice(0, 10).map((s, i) => ({
            rollNumber: s.rollNumber || s.id,
            name: s.name,
            attended: 40 - (i % 5),
            total: 45,
            percentage: Math.round(((40 - (i % 5)) / 45) * 100)
        }));

        renderReportTable(mockStudents);
        loadReportChart();
    }

    function loadReportChart() {
        const ctx = document.getElementById('reportChart');
        if (!ctx) return;

        if (myReportChart) {
            myReportChart.destroy();
        }

        const filter = document.getElementById('reportChartFilter')?.value || 'week';
        let labels, data;

        if (filter === 'week') {
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            data = [85, 82, 78, 90, 85, 70];
        } else if (filter === 'month') {
            labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            data = [82, 85, 88, 86];
        } else {
            labels = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            data = [88, 85, 82, 87, 85];
        }

        myReportChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance %',
                    data: data,
                    backgroundColor: 'rgba(139, 127, 216, 0.7)',
                    borderColor: '#8B7FD8',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    }

    window.loadWeeklySchedule = async function () {
        const container = document.getElementById('weeklyScheduleContainer');
        if (!container) return;

        try {
            const response = await apiRequest('/timetable');
            const timetable = response.timetable || [];

            // Group by day
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const grouped = {};
            days.forEach(day => grouped[day.toLowerCase()] = []);

            timetable.forEach(entry => {
                if (grouped[entry.day]) {
                    grouped[entry.day].push(entry);
                }
            });

            container.innerHTML = `
                <div class="weekly-calendar">
                    ${days.map(day => `
                        <div class="day-column">
                            <div class="day-header">${day}</div>
                            <div class="day-classes">
                                ${(grouped[day.toLowerCase()] || []).length === 0
                    ? '<div class="text-center text-muted small p-3">No classes</div>'
                    : grouped[day.toLowerCase()].map(cls => `
                                        <div class="mini-class-card">
                                            <div class="time">${formatTime(cls.startTime)} - ${formatTime(cls.endTime)}</div>
                                            <div class="subject">${cls.subject?.name || 'Subject'}</div>
                                            <div class="room"><i class="bi bi-geo-alt"></i> ${cls.room || 'TBD'}</div>
                                        </div>
                                    `).join('')
                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Also update today's detailed schedule
            loadTodayDetailedSchedule(timetable);
        } catch (error) {
            console.error('Failed to load weekly schedule:', error);
            container.innerHTML = '<div class="text-center text-muted p-4">Failed to load schedule</div>';
        }
    };

    function loadTodayDetailedSchedule(timetable) {
        const container = document.getElementById('todayDetailedSchedule');
        if (!container) return;

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        const todayClasses = timetable.filter(t => t.day === today);

        if (todayClasses.length === 0) {
            container.innerHTML = '<p class="text-muted">No classes scheduled for today</p>';
            return;
        }

        container.innerHTML = todayClasses.map((cls, index) => `
            <div class="class-item ${index === 0 ? 'active-class' : ''}">
                <div class="class-info">
                    <div class="class-time-box">
                        <span class="start-time">${formatTime(cls.startTime)}</span>
                        <span class="end-time">to ${formatTime(cls.endTime)}</span>
                    </div>
                    <div class="class-details">
                        <h6>${cls.subject?.name || 'Subject'} <span class="type-badge ${getTypeBadgeClass(cls.type)}">${cls.type || 'Lecture'}</span></h6>
                        <small><i class="bi bi-geo-alt"></i> ${cls.room || 'TBD'}</small>
                    </div>
                </div>
                <button class="btn ${index === 0 ? 'btn-primary' : 'btn-outline-primary'} btn-sm" 
                    onclick="openAttendanceModal('${cls.subject?.name || 'Subject'} ${cls.type || 'Lecture'}', '${cls._id || ''}')">
                    ${index === 0 ? 'Take Attendance' : 'View'}
                </button>
            </div>
        `).join('');
    }

    // --- 6. ATTENDANCE MODAL ---

    window.openAttendanceModal = function (className, timetableId) {
        currentClassTitle = className;
        currentSessionId = timetableId;
        document.getElementById('modalClassTitle').innerText = className;

        // Reset GPS indicator
        const gpsDot = document.getElementById('gpsIndicator');
        const gpsText = document.getElementById('gpsText');
        gpsDot.classList.remove('gps-active');
        gpsDot.style.backgroundColor = 'orange';
        gpsText.innerText = "Searching for Anchor Device...";

        // Reset students
        students.forEach(s => s.status = false);

        attendanceModalObj.show();

        // Simulate GPS connection
        setTimeout(() => {
            gpsDot.style.backgroundColor = '#6BCF7F';
            gpsDot.classList.add('gps-active');
            gpsText.innerText = "Anchor Device Active • GPS Locked";

            renderStudentList();
            updateAttendanceStats();
        }, 1500);
    };

    window.startQuickAttendance = function () {
        quickAttendanceModalObj.show();
    };

    window.startAttendanceFromModal = function () {
        const classSelect = document.getElementById('quickClassSelect');
        const classType = document.getElementById('quickClassType');
        const room = document.getElementById('quickRoomInput');

        if (!classSelect.value) {
            showToast('Please select a class', 'warning');
            return;
        }

        quickAttendanceModalObj.hide();
        openAttendanceModal(`${classSelect.options[classSelect.selectedIndex].text}`, classSelect.value);
    };

    function renderStudentList() {
        const tbody = document.getElementById('studentListBody');
        if (!tbody) return;

        tbody.innerHTML = students.map((s, idx) => `
            <tr class="student-row ${s.status ? 'present' : 'absent'}">
                <td><span class="fw-bold text-secondary">${s.id}</span></td>
                <td>${s.name}</td>
                <td class="text-end">
                    <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input" type="checkbox" 
                            onchange="toggleStudent(${idx}, this)" ${s.status ? 'checked' : ''}>
                    </div>
                </td>
            </tr>
        `).join('');

        document.getElementById('totalStudentCount').innerText = students.length;
    }

    window.toggleStudent = function (index, checkbox) {
        students[index].status = checkbox.checked;
        renderStudentList();
        updateAttendanceStats();
    };

    window.markAll = function (isPresent) {
        students.forEach(s => s.status = isPresent);
        renderStudentList();
        updateAttendanceStats();
    };

    function updateAttendanceStats() {
        const present = students.filter(s => s.status).length;
        const total = students.length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;

        document.getElementById('presentCount').innerText = present;
        document.getElementById('absentCount').innerText = total - present;

        const bar = document.getElementById('progressBar');
        bar.style.width = pct + '%';
        bar.className = `progress-bar ${pct < 50 ? 'bg-danger' : (pct < 75 ? 'bg-warning' : 'bg-success')}`;
    }

    window.submitAttendance = async function () {
        const btn = document.querySelector('.modal-footer .btn-success');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        btn.disabled = true;

        try {
            // Prepare attendance data
            const attendanceData = {
                timetableId: currentSessionId,
                records: students.map(s => ({
                    studentId: s.id,
                    status: s.status ? 'present' : 'absent'
                }))
            };

            await apiRequest('/attendance/manual', {
                method: 'POST',
                body: JSON.stringify(attendanceData)
            });

            showToast(`Attendance for ${currentClassTitle} saved successfully!`, 'success');
            attendanceModalObj.hide();

            // Refresh stats
            loadAttendanceStats();
        } catch (error) {
            console.error('Failed to submit attendance:', error);
            showToast('Failed to save attendance. Please try again.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    window.downloadCSV = function () {
        let csv = "RollNo,Name,Status,Date\n";
        const date = new Date().toLocaleDateString();
        students.forEach(s => {
            csv += `${s.id},"${s.name}",${s.status ? 'Present' : 'Absent'},${date}\n`;
        });

        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        link.download = `Attendance_${currentClassTitle.replace(/\s+/g, '_')}_${date.replace(/\//g, '-')}.csv`;
        link.click();

        showToast('CSV downloaded successfully!', 'success');
    };

    // --- 7. REPORT EXPORTS ---

    window.downloadAttendanceReport = function () {
        const table = document.getElementById('reportTableBody');
        if (!table) return;

        let csv = 'Roll No,Student Name,Classes Attended,Total Classes,Percentage,Status\n';
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                csv += Array.from(cells).map(c => '"' + c.textContent.trim() + '"').join(',') + '\n';
            }
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_report.csv';
        a.click();
        URL.revokeObjectURL(url);

        showToast('Report downloaded successfully!', 'success');
    };

    window.exportToExcel = function () {
        const table = document.querySelector('#reports-section table');
        if (!table || typeof XLSX === 'undefined') {
            showToast('Export feature not available', 'error');
            return;
        }

        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, 'attendance_report.xlsx');

        showToast('Excel file downloaded!', 'success');
    };

    window.downloadAllReports = function () {
        navigateToSection('reports-section');
        setTimeout(() => downloadAttendanceReport(), 500);
    };

    // --- 8. FORM HANDLERS ---

    function setupFormHandlers() {
        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                try {
                    await apiRequest(`/users/${user._id || user.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            name: document.getElementById('profileName').value,
                            phone: document.getElementById('profilePhone').value,
                            department: document.getElementById('profileDept').value
                        })
                    });
                    user.name = document.getElementById('profileName').value;
                    localStorage.setItem('user', JSON.stringify(user));
                    updateFacultyInfo();
                    showToast('Profile updated successfully!', 'success');
                } catch (error) {
                    showToast('Failed to update profile', 'error');
                }
            });
        }

        // Change password form
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (newPassword !== confirmPassword) {
                    showToast('Passwords do not match!', 'warning');
                    return;
                }

                try {
                    await apiRequest('/auth/password', {
                        method: 'PUT',
                        body: JSON.stringify({
                            currentPassword: document.getElementById('currentPassword').value,
                            newPassword: newPassword
                        })
                    });
                    showToast('Password changed successfully!', 'success');
                    changePasswordForm.reset();
                } catch (error) {
                    showToast('Failed to change password', 'error');
                }
            });
        }

        // Attendance settings form
        const attendanceSettingsForm = document.getElementById('attendanceSettingsForm');
        if (attendanceSettingsForm) {
            attendanceSettingsForm.addEventListener('submit', function (e) {
                e.preventDefault();
                showToast('Settings saved!', 'success');
            });
        }

        // Notification settings form
        const notificationSettingsForm = document.getElementById('notificationSettingsForm');
        if (notificationSettingsForm) {
            notificationSettingsForm.addEventListener('submit', function (e) {
                e.preventDefault();
                showToast('Notification settings saved!', 'success');
            });
        }
    }

    // --- 9. UTILITIES ---

    function formatTime(time) {
        if (!time) return '--:--';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    function getTypeBadgeClass(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('lab')) return 'type-lab';
        if (t.includes('tutorial')) return 'type-tutorial';
        return 'type-lecture';
    }

    function showToast(message, type = 'info') {
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(message, type);
        } else {
            // Fallback toast
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;
            toast.innerHTML = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 16px 24px;
                background: ${type === 'success' ? '#6BCF7F' : type === 'error' ? '#FF6B9D' : '#8B7FD8'};
                color: white;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                z-index: 9999;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }

    window.viewStudentDetails = function (studentId) {
        // Find the student
        const student = allStudents.find(s => s._id === studentId || s.id === studentId);
        if (!student) {
            showToast('Student not found', 'error');
            return;
        }

        // Create modal for student details
        const modalHtml = `
            <div class="modal fade" id="studentDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header modal-header-gradient">
                            <h5 class="modal-title fw-bold">Student Details</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=8B7FD8&color=fff&bold=true&size=100"
                                    alt="${student.name}" class="rounded-circle mb-3" style="width: 100px; height: 100px;">
                                <h4>${student.name}</h4>
                                <span class="badge bg-primary">${student.rollNumber || '-'}</span>
                            </div>
                            <div class="row g-3">
                                <div class="col-6">
                                    <div class="card bg-light border-0 p-3">
                                        <small class="text-muted">Email</small>
                                        <div class="fw-bold">${student.email || '-'}</div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card bg-light border-0 p-3">
                                        <small class="text-muted">Branch</small>
                                        <div class="fw-bold">${student.branch || '-'}</div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card bg-light border-0 p-3">
                                        <small class="text-muted">Semester</small>
                                        <div class="fw-bold">${student.semester || '-'}</div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card bg-light border-0 p-3">
                                        <small class="text-muted">Attendance</small>
                                        <div class="fw-bold text-${(student.attendancePercentage || 0) >= 75 ? 'success' : 'danger'}">
                                            ${student.attendancePercentage || 0}%
                                        </div>
                                    </div>
                                </div>
                                <div class="col-12">
                                    <div class="card bg-light border-0 p-3">
                                        <small class="text-muted">Batch</small>
                                        <div class="fw-bold">${student.batch || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-primary" onclick="viewStudentAttendance('${studentId}')">
                                <i class="bi bi-calendar-check me-2"></i>View Attendance
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('studentDetailsModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('studentDetailsModal'));
        modal.show();

        // Clean up when modal is hidden
        document.getElementById('studentDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    };

    window.viewStudentAttendance = async function (studentId) {
        // Close any existing modals
        const existingModal = bootstrap.Modal.getInstance(document.getElementById('studentDetailsModal'));
        if (existingModal) existingModal.hide();

        try {
            const response = await apiRequest(`/attendance/student/${studentId}/report`);
            const report = response.report || {};
            const student = allStudents.find(s => s._id === studentId || s.id === studentId);

            // Create attendance modal
            const subjectsHtml = (report.subjects || []).map(s => `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.present + (s.late || 0)}</td>
                    <td>${s.total}</td>
                    <td class="${s.percentage < 75 ? 'text-danger fw-bold' : 'text-success'}">${s.percentage}%</td>
                </tr>
            `).join('') || '<tr><td colspan="4" class="text-center text-muted">No attendance data available</td></tr>';

            const modalHtml = `
                <div class="modal fade" id="studentAttendanceModal" tabindex="-1">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header modal-header-gradient">
                                <h5 class="modal-title fw-bold">Attendance Report - ${student?.name || 'Student'}</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-4">
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-success text-white p-3">
                                            <h3>${report.overallPercentage || 0}%</h3>
                                            <small>Overall Attendance</small>
                                        </div>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-primary text-white p-3">
                                            <h3>${report.totalPresent || 0}</h3>
                                            <small>Classes Attended</small>
                                        </div>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <div class="card bg-info text-white p-3">
                                            <h3>${report.totalClasses || 0}</h3>
                                            <small>Total Classes</small>
                                        </div>
                                    </div>
                                </div>
                                <h6 class="mb-3"><i class="bi bi-book me-2"></i>Subject-wise Attendance</h6>
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Subject</th>
                                                <th>Attended</th>
                                                <th>Total</th>
                                                <th>Percentage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${subjectsHtml}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingAttModal = document.getElementById('studentAttendanceModal');
            if (existingAttModal) existingAttModal.remove();

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('studentAttendanceModal'));
            modal.show();

            // Clean up when modal is hidden
            document.getElementById('studentAttendanceModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });
        } catch (error) {
            console.error('Failed to load student attendance:', error);
            showToast('Failed to load attendance data', 'error');
        }
    };

    // Logout function
    window.logout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
    };

})();
