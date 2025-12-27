(function () {
    'use strict';

    // Authentication Check
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
        window.location.href = '/pages/login';
        return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'student') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
        return;
    }

    // API Configuration
    const API_BASE = '/api';
    async function apiRequest(endpoint, options = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        });
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/pages/login';
            }
            const error = await response.json();
            throw new Error(error.message || 'Request failed');
        }
        return response.json();
    }

    // CONFIG
    const COLLEGE_LAT = 21.2500;
    const COLLEGE_LNG = 81.6300;
    const ALLOWED_RADIUS = 15; // 15 Meters

    // Data storage
    let fullTimetable = {};
    let weeklySchedule = {};
    let reportData = { weekly: null, monthly: null, overall: null };
    let activityLog = [];
    let notifications = [];
    let attendanceHistory = [];
    let studentProfile = {};

    let currentButton = null, videoStream = null, trendChart = null, subChart = null;
    let dashboardChart = null;
    let modalObj;

    window.onload = async function () {
        modalObj = new bootstrap.Modal(document.getElementById('cameraModal'));

        // Update date display
        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateDisplay.textContent = today.toLocaleDateString('en-US', options);
        }

        // Update student info
        updateStudentInfo();

        // Connect to socket for real-time updates
        connectToSocket();

        // Load data from API
        await Promise.all([
            loadTimetable(),
            loadAttendanceData(),
            loadNotices(),
            loadUserProfile()
        ]);

        loadDashboardSchedule();
        renderTimetable();
        updateReport('weekly', document.querySelector('#reports .btn-primary, .report-filter-btn.active'));
        updateActivityFeed();
        showNotifications();
        checkLowAttendance();
        populateAttendanceHistory();
        initDashboardChart();
        updateSubjectProgress();
        updateNextClass();
        renderProfile();
        setupEditProfile(); // Initialize edit profile functionality

        // Restore settings from localStorage and user preferences
        const dm = localStorage.getItem('darkMode') === '1' || user.preferences?.darkMode;
        if (document.getElementById('darkModeToggle')) {
            document.getElementById('darkModeToggle').checked = dm;
            if (dm) toggleDarkMode({ checked: true });
        }
        const en = localStorage.getItem('emailNotif') !== '0' && (user.preferences?.emailNotifications !== false);
        if (document.getElementById('emailNotifToggle')) document.getElementById('emailNotifToggle').checked = en;

        // Setup edit profile button
        setupEditProfile();
    };

    // Initialize the dashboard attendance chart (new Mindo style)
    function initDashboardChart() {
        const canvas = document.getElementById('attendanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Gradient for the chart
        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, 'rgba(139, 127, 216, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 127, 216, 0.05)');

        // Use real data from reportData, default to zeros if no data
        const data = reportData.weekly?.d || [0, 0, 0, 0, 0];
        const labels = reportData.weekly?.l || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

        dashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: '#8B7FD8',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8B7FD8',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Attendance: ${context.raw}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false,
                        min: 0,
                        max: 100
                    }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                }
            }
        });

        // Update chart labels in the UI
        const chartDays = document.querySelector('.chart-days');
        if (chartDays) {
            chartDays.innerHTML = labels.map(label =>
                `<span class="chart-day">${label.toUpperCase()}</span>`
            ).join('');
        }
    }

    // Update dashboard chart
    window.updateDashboardChart = function () {
        const select = document.getElementById('chartTimeSelect');
        if (!select || !dashboardChart) return;

        const period = select.value;
        let data, labels;

        if (period === 'month') {
            data = reportData.monthly?.d || [0, 0, 0, 0];
            labels = reportData.monthly?.l || ['W1', 'W2', 'W3', 'W4'];
        } else {
            data = reportData.weekly?.d || [0, 0, 0, 0, 0];
            labels = reportData.weekly?.l || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        }

        dashboardChart.data.labels = labels;
        dashboardChart.data.datasets[0].data = data;
        dashboardChart.update();

        // Update chart days labels
        const chartDays = document.querySelector('.chart-days');
        if (chartDays) {
            chartDays.innerHTML = labels.map(label =>
                `<span class="chart-day">${label.toUpperCase()}</span>`
            ).join('');
        }

        // Update chart title
        const chartTitle = document.querySelector('.chart-title p');
        if (chartTitle) {
            chartTitle.textContent = period === 'month' ? 'This month' : 'This week';
        }
    };

    // Update subject progress in right column
    function updateSubjectProgress() {
        const container = document.getElementById('subjectProgressList');
        if (!container) return;

        const subjects = reportData.overall?.s || reportData.weekly?.s || [];

        // Handle empty subjects
        if (subjects.length === 0) {
            container.innerHTML = `
                <div class="progress-item text-center py-3">
                    <span class="text-muted small">No subject data available</span>
                </div>
            `;
            const avgEl = document.getElementById('avgPerformance');
            if (avgEl) avgEl.textContent = '0%';
            return;
        }

        let totalPercentage = 0;
        let html = '';

        subjects.slice(0, 4).forEach(subject => {
            const percentage = subject.t > 0 ? Math.round((subject.a / subject.t) * 100) : 0;
            totalPercentage += percentage;

            let fillClass = '';
            if (percentage >= 75) fillClass = 'success-fill';
            else if (percentage >= 50) fillClass = 'purple-fill';
            else fillClass = 'warning-fill';

            html += `
                <div class="progress-item">
                    <span class="progress-label">${subject.n || 'Subject'}</span>
                    <div class="progress-bar-container">
                        <div class="progress-fill ${fillClass}" style="width: ${percentage}%"></div>
                    </div>
                    <span class="progress-value">${percentage}%</span>
                </div>
            `;
        });

        container.innerHTML = html;

        // Update average performance
        const avgEl = document.getElementById('avgPerformance');
        if (avgEl && subjects.length > 0) {
            avgEl.textContent = Math.round(totalPercentage / subjects.length) + '%';
        }
    }

    // Update next class information
    function updateNextClass() {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let today = days[new Date().getDay()];
        if (today === "Sunday") today = "Monday";

        const list = weeklySchedule[today] || [];
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        let nextClass = null;
        for (const item of list) {
            const [hh, mm] = item.t.split(':').map(x => parseInt(x));
            const itemMinutes = (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
            if (itemMinutes > nowMinutes) {
                nextClass = { ...item, startMinutes: itemMinutes };
                break;
            }
        }

        const nameEl = document.getElementById('nextClassName');
        const facultyEl = document.getElementById('nextClassFaculty');
        const hoursEl = document.getElementById('countdownHours');
        const minsEl = document.getElementById('countdownMins');

        if (nextClass && nameEl) {
            nameEl.textContent = nextClass.s;
            if (facultyEl) facultyEl.textContent = `Room: ${nextClass.r}`;

            const diff = nextClass.startMinutes - nowMinutes;
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;

            if (hoursEl) hoursEl.textContent = hours;
            if (minsEl) minsEl.textContent = mins;
        } else if (nameEl) {
            nameEl.textContent = 'No more classes today';
            if (facultyEl) facultyEl.textContent = '-';
            if (hoursEl) hoursEl.textContent = '0';
            if (minsEl) minsEl.textContent = '0';
        }
    }

    // Socket connection for real-time notifications
    function connectToSocket() {
        if (typeof socketService !== 'undefined') {
            socketService.connect();

            // Listen for new notices
            socketService.on('newNotice', (data) => {
                showToast(`📢 New Notice: ${data.title}`, 'info');
                // Reload notices to show the new one
                loadNotices();
            });

            // Listen for attendance session start
            socketService.on('newAttendanceSession', (data) => {
                showToast(`📋 Attendance session started: ${data.subjectName}`, 'warning');
                // Update activity feed
                activityLog.unshift({
                    icon: '📋',
                    text: `Attendance session started for ${data.subjectName}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                updateActivityFeed();
            });

            // Listen for attendance confirmation
            socketService.on('attendanceConfirmed', (data) => {
                showToast(`✅ Attendance marked: ${data.status}`, 'success');
                // Reload attendance data and refresh schedule
                loadAttendanceData().then(() => {
                    loadDashboardSchedule();
                });
            });
        }
    }

    function updateStudentInfo() {
        // Update student name in header (new structure)
        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl) studentNameEl.textContent = user.name || 'Student';

        // Update student name in header (old structure)
        const welcomeNameEl = document.getElementById('studentWelcomeName');
        if (welcomeNameEl) welcomeNameEl.textContent = `Welcome, ${(user.name || 'Student').toUpperCase()}`;

        // Update student info line (branch, semester, roll number) - old structure
        const infoLineEl = document.getElementById('studentInfoLine');
        if (infoLineEl) {
            const branch = user.branch || 'CSE';
            const semester = user.semester || '1';
            const rollNo = user.rollNumber || user.rollNo || 'N/A';
            infoLineEl.textContent = `BE-${branch}-${semester}${getOrdinalSuffix(semester)} Sem | Roll No: ${rollNo}`;
        }

        // Update date display
        const dateEl = document.getElementById('currentDateDisplay');
        if (dateEl) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = today.toLocaleDateString('en-US', options);
        }

        // Update profile photos
        const photoEl = document.getElementById('studentProfilePhoto');
        if (photoEl && user.profileImage) {
            photoEl.src = user.profileImage;
        }
        const navPhotoEl = document.getElementById('navProfileImage');
        if (navPhotoEl && user.profileImage) {
            navPhotoEl.src = user.profileImage;
        }

        // Update profile data
        studentProfile = {
            name: user.name || 'Student',
            photo: user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
            rollNo: user.rollNumber || user.rollNo || '-',
            branch: user.branch || 'CSE',
            semester: user.semester || '1',
            collegeEmail: user.email,
            phone: user.phone || '-'
        };
    }

    // Helper function to get ordinal suffix
    function getOrdinalSuffix(num) {
        const n = parseInt(num);
        if (n === 1) return 'st';
        if (n === 2) return 'nd';
        if (n === 3) return 'rd';
        return 'th';
    }

    // Show toast notification
    function showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
            document.body.appendChild(toastContainer);
        }

        // Icon mapping
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        // Color mapping
        const colors = {
            success: { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: '#10b981' },
            error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' },
            warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '#3b82f6' }
        };

        const colorSet = colors[type] || colors.info;
        const icon = icons[type] || icons.info;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            background: ${colorSet.bg};
            border-left: 4px solid ${colorSet.border};
            color: ${colorSet.text};
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 450px;
            animation: slideInRight 0.3s ease forwards;
            transform: translateX(100%);
            opacity: 0;
        `;

        toast.innerHTML = `
            <i class="bi ${icon}" style="font-size: 1.25rem; color: ${colorSet.icon};"></i>
            <span style="flex: 1; font-weight: 500;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; opacity: 0.7; color: ${colorSet.text};">&times;</button>
        `;

        // Add animation keyframes if not exists
        if (!document.getElementById('toast-animation-style')) {
            const style = document.createElement('style');
            style.id = 'toast-animation-style';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        toastContainer.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
        return container;
    }

    async function loadTimetable() {
        try {
            console.log('Loading timetable for user:', user);
            const response = await apiRequest('/timetable');
            console.log('Timetable API response:', response);
            const timetableData = response.timetable || [];
            console.log('Timetable data received:', timetableData.length, 'entries');

            // Process timetable data
            fullTimetable = {};
            weeklySchedule = {};

            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            days.forEach(day => {
                fullTimetable[day] = [];
                weeklySchedule[day] = [];
            });

            timetableData.forEach(item => {
                const day = item.day;
                // Capitalize first letter to match keys
                const dayKey = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

                if (fullTimetable[dayKey]) {
                    const subjectName = item.subject?.name || item.subjectName || 'Subject';
                    const facultyName = item.faculty?.name || 'Faculty TBA';
                    const timeRange = `${item.startTime}-${item.endTime}`;

                    fullTimetable[dayKey].push(`${subjectName} (${timeRange})`);
                    weeklySchedule[dayKey].push({
                        t: item.startTime,
                        s: subjectName,
                        r: item.room || 'TBA',
                        faculty: facultyName,
                        facultyId: item.faculty?._id,
                        subjectId: item.subject?._id || item.subjectId,
                        st: 'Pending',
                        endTime: item.endTime
                    });
                }
            });

            console.log('Processed timetable:', fullTimetable);
            console.log('Weekly schedule:', weeklySchedule);

            // Check if we have actual data
            const hasData = Object.values(fullTimetable).some(day => day.length > 0);

            if (!hasData) {
                console.warn('No timetable data found. Please ensure timetable is configured in admin panel.');
                showToast('No timetable found. Please contact your administrator.', 'warning');
            }
        } catch (error) {
            console.error('Failed to load timetable:', error);
            showToast('Failed to load timetable. Please try again later.', 'error');
            // Initialize empty structure
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            days.forEach(day => {
                fullTimetable[day] = [];
                weeklySchedule[day] = [];
            });
        }
    }

    async function loadAttendanceData() {
        try {
            console.log('Loading attendance data...');
            const response = await apiRequest('/attendance/student/report');
            console.log('Attendance API response:', response);
            const data = response.report || {};
            console.log('Attendance report data:', data);

            // Process attendance data for reports
            if (data.subjects && data.subjects.length > 0) {
                reportData.weekly = {
                    l: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                    d: data.weeklyTrend || [0, 0, 0, 0, 0],
                    s: data.subjects.map(s => ({ n: s.name, t: s.total || 0, a: s.present || 0 }))
                };
                reportData.monthly = {
                    l: ["W1", "W2", "W3", "W4"],
                    d: data.monthlyTrend || [0, 0, 0, 0],
                    s: data.subjects.map(s => ({ n: s.name, t: s.total || 0, a: s.present || 0 }))
                };
                reportData.overall = {
                    l: data.overallLabels || ["W1", "W2", "W3", "W4"],
                    d: data.overallTrend || [0, 0, 0, 0],
                    s: data.subjects.map(s => ({ n: s.name, t: s.total || 0, a: s.present || 0 }))
                };

                // Update attendance history
                attendanceHistory = (data.history || []).map(h => ({
                    date: new Date(h.date).toISOString().slice(0, 10),
                    subject: h.subject?.name || h.subjectName || 'Subject',
                    subjectId: h.subject?._id,
                    status: h.status
                }));

                // Update activity log from recent history
                activityLog = (data.history || []).slice(0, 5).map(h => ({
                    icon: h.status === 'present' ? '✅' : (h.status === 'late' ? '⚠️' : '❌'),
                    text: `Attendance ${h.status} for ${h.subject?.name || h.subjectName || 'Class'}`,
                    time: new Date(h.date).toLocaleDateString()
                }));

                // Update today's schedule with attendance status
                updateScheduleWithAttendance(data.history || []);
            } else {
                console.warn('No attendance data received from server');
                // Initialize empty but valid structure
                reportData = {
                    weekly: { l: ["Mon", "Tue", "Wed", "Thu", "Fri"], d: [0, 0, 0, 0, 0], s: [] },
                    monthly: { l: ["W1", "W2", "W3", "W4"], d: [0, 0, 0, 0], s: [] },
                    overall: { l: ["W1", "W2", "W3", "W4"], d: [0, 0, 0, 0], s: [] }
                };
            }

            // Call updateFloatingStats after data is loaded
            updateFloatingStats();
            updateSubjectProgress();

        } catch (error) {
            console.error('Failed to load attendance:', error);
            showToast('Failed to load attendance data', 'error');
            // Set empty data structure on error
            reportData = {
                weekly: { l: ["Mon", "Tue", "Wed", "Thu", "Fri"], d: [0, 0, 0, 0, 0], s: [] },
                monthly: { l: ["W1", "W2", "W3", "W4"], d: [0, 0, 0, 0], s: [] },
                overall: { l: ["W1", "W2", "W3", "W4"], d: [0, 0, 0, 0], s: [] }
            };
        }
    }

    function updateScheduleWithAttendance(history) {
        if (!history || history.length === 0) return;

        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter today's records
        const todayRecords = history.filter(record => {
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate.getTime() === today.getTime();
        });

        // Get current day name
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[today.getDay()];

        // Update weeklySchedule with attendance status
        if (weeklySchedule[currentDay]) {
            weeklySchedule[currentDay].forEach(scheduleItem => {
                // Find matching attendance record
                const attendanceRecord = todayRecords.find(record => {
                    const recordSubjectId = record.subject?._id || record.subjectId;
                    return recordSubjectId && recordSubjectId.toString() === scheduleItem.subjectId?.toString();
                });

                if (attendanceRecord) {
                    // Update status based on attendance record
                    if (attendanceRecord.status === 'present') {
                        scheduleItem.st = 'Present';
                    } else if (attendanceRecord.status === 'late') {
                        scheduleItem.st = 'Late';
                    } else if (attendanceRecord.status === 'absent') {
                        scheduleItem.st = 'Absent';
                    }
                }
            });
        }
    }

    async function loadNotices() {
        try {
            console.log('Loading notices...');
            const response = await apiRequest('/notices');
            console.log('Notices API response:', response);
            const noticesData = response.notices || [];
            console.log('Notices data received:', noticesData.length, 'notices');

            notifications = noticesData.map(n => ({
                t: new Date(n.createdAt).toLocaleDateString(),
                msg: n.title,
                id: n._id
            }));

            // Update notices badge
            const noticesBadge = document.getElementById('noticesBadge');
            if (noticesBadge) {
                noticesBadge.textContent = noticesData.length;
                noticesBadge.style.display = noticesData.length > 0 ? 'inline' : 'none';
            }

            // Render notices in notices section
            const noticesContainer = document.getElementById('noticesContainer');
            if (noticesContainer) {
                if (noticesData.length === 0) {
                    noticesContainer.innerHTML = `
                        <div class="text-center py-5">
                            <i class="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                            <p class="text-muted">No notices available</p>
                        </div>`;
                } else {
                    noticesContainer.innerHTML = noticesData.map(n => `
                        <div class="notice-card mb-3" style="background: rgba(255,255,255,0.7); border-radius: 16px; padding: 20px; border-left: 4px solid ${n.priority === 'high' ? 'var(--danger-red)' : n.priority === 'medium' ? 'var(--warning-orange)' : 'var(--primary-purple)'};">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="fw-bold mb-0" style="color: var(--text-primary);">${n.title}</h6>
                                <span class="badge rounded-pill" style="background: ${n.priority === 'high' ? 'rgba(255,107,107,0.15)' : n.priority === 'medium' ? 'rgba(255,179,71,0.15)' : 'rgba(139,127,216,0.15)'}; color: ${n.priority === 'high' ? 'var(--danger-red)' : n.priority === 'medium' ? 'var(--warning-orange)' : 'var(--primary-purple)'}; font-weight: 600;">
                                    ${n.priority.toUpperCase()}
                                </span>
                            </div>
                            <p class="mb-2" style="color: var(--text-secondary); font-size: 14px;">${n.content}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small style="color: var(--text-secondary);">
                                    <i class="bi bi-calendar3 me-1"></i>${new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </small>
                                ${n.author ? `<small style="color: var(--text-secondary);"><i class="bi bi-person me-1"></i>${n.author.name || 'Admin'}</small>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Update notification dropdown
            updateNotificationDropdown(noticesData);

        } catch (error) {
            console.error('Failed to load notices:', error);
            notifications = [];
        }
    }

    // Update notification dropdown with recent notices
    function updateNotificationDropdown(notices) {
        const notifList = document.getElementById('notifList');
        const notifBadge = document.getElementById('notifBadge');

        if (!notifList) return;

        // Show only recent 5 notices as notifications
        const recentNotices = notices.slice(0, 5);

        if (notifBadge) {
            notifBadge.textContent = recentNotices.length;
            notifBadge.style.display = recentNotices.length > 0 ? 'flex' : 'none';
        }

        if (recentNotices.length === 0) {
            notifList.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-bell-slash fs-4 d-block mb-2"></i>
                    No new notifications
                </div>`;
        } else {
            notifList.innerHTML = recentNotices.map(n => `
                <div class="notification-item d-flex align-items-start gap-2 p-2 rounded mb-2" style="background: rgba(232, 228, 249, 0.3); cursor: pointer;" onclick="navigateToSection('notices-section')">
                    <div class="notification-icon" style="width: 32px; height: 32px; border-radius: 8px; background: ${n.priority === 'high' ? 'rgba(255,107,107,0.15)' : 'rgba(139,127,216,0.15)'}; display: flex; align-items: center; justify-content: center;">
                        <i class="bi bi-megaphone" style="color: ${n.priority === 'high' ? 'var(--danger-red)' : 'var(--primary-purple)'};"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-semibold small" style="color: var(--text-primary);">${n.title}</div>
                        <div class="text-muted" style="font-size: 11px;">${new Date(n.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Load user profile data from backend
    async function loadUserProfile() {
        try {
            const response = await apiRequest(`/users/${user._id || user.id}`);
            if (response.success && response.user) {
                // Update local user data
                Object.assign(user, response.user);
                localStorage.setItem('user', JSON.stringify(user));

                // Update studentProfile object with all fields
                studentProfile = {
                    photo: user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
                    name: user.name || 'Student',
                    dob: user.dateOfBirth || user.dob || '',
                    gender: user.gender || '-',
                    blood: user.bloodGroup || '-',
                    father: user.fatherName || '-',
                    mother: user.motherName || '-',
                    admissionNo: user.admissionNumber || user.admissionNo || '-',
                    rollNo: user.rollNumber || user.rollNo || '-',
                    regId: user.registrationId || user.regId || '-',
                    degree: user.degree || 'BE',
                    branch: user.branch || 'CSE',
                    semester: user.semester || '1',
                    batch: user.batch || '-',
                    collegeEmail: user.email || '-',
                    personalEmail: user.personalEmail || '-',
                    phone: user.phone || '-',
                    addressCurrent: user.currentAddress || '-',
                    addressPermanent: user.permanentAddress || '-'
                };

                // Re-render profile
                renderProfile();
                updateStudentInfo();
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    // Save user settings to backend
    async function saveUserSettings(settings) {
        try {
            const response = await apiRequest(`/users/${user._id || user.id}`, {
                method: 'PUT',
                body: JSON.stringify(settings)
            });

            if (response.success) {
                // Update local storage
                Object.assign(user, response.user);
                localStorage.setItem('user', JSON.stringify(user));
                showToast('Settings saved successfully!', 'success');
                return true;
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast('Failed to save settings', 'error');
            return false;
        }
    }

    // Update profile image
    async function updateProfileImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`${API_BASE}/users/${user._id || user.id}/profile-image`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                user.profileImage = data.user.profileImage;
                localStorage.setItem('user', JSON.stringify(user));

                // Update all profile images on page
                document.querySelectorAll('#profilePhoto, #navProfileImage').forEach(img => {
                    img.src = data.user.profileImage;
                });

                showToast('Profile image updated!', 'success');
                return true;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to update profile image:', error);
            showToast('Failed to update profile image', 'error');
            return false;
        }
    }

    // VIEW SWITCHER (Legacy - for old HTML structure)
    window.switchView = function (id, link) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(id);
        if (!target) return;
        target.classList.add('active');
        // manage nav active state only when a navbar link is provided
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active-view'));
        if (link && link.classList && link.classList.contains('nav-link')) link.classList.add('active-view');
        // if showing profile view, render it
        if (id === 'profile') renderProfile();
    };

    // NEW VIEW SWITCHER (For new Mindo-style HTML structure)
    window.navigateToSection = function (sectionId, clickedEl) {
        // Hide all page sections
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));

        // Show the target section
        const target = document.getElementById(sectionId);
        if (!target) return;
        target.classList.add('active');

        // Update URL hash
        window.location.hash = sectionId;

        // Update navbar active state
        document.querySelectorAll('.navbar-menu .nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

        if (clickedEl) {
            clickedEl.classList.add('active');
        } else {
            // Find and activate the correct nav item
            const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
            if (navItem) navItem.classList.add('active');
            const mobileNavItem = document.querySelector(`.mobile-nav-item[data-section="${sectionId}"]`);
            if (mobileNavItem) mobileNavItem.classList.add('active');
        }

        // Handle profile section
        if (sectionId === 'profile-section') renderProfile();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle URL hash on page load
    function handleHashNavigation() {
        const hash = window.location.hash.substring(1); // Remove #
        if (hash && document.getElementById(hash)) {
            navigateToSection(hash);
        }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);

    // Call on page load after elements are rendered
    document.addEventListener('DOMContentLoaded', handleHashNavigation);

    // RENDER DASHBOARD SCHEDULE
    function loadDashboardSchedule() {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let today = days[new Date().getDay()];
        if (today === "Sunday") today = "Monday"; // Demo

        const dayBadge = document.getElementById('dayBadge');
        if (dayBadge) dayBadge.innerText = today;

        const list = weeklySchedule[today] || [];

        // Support for old table structure
        const tbody = document.getElementById('scheduleTableBody');
        // Support for new Mindo-style card structure
        const scheduleList = document.getElementById('scheduleList');

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        let activeIndex = -1, nextIndex = -1;

        list.forEach((item, idx) => {
            const [hh, mm] = item.t.split(':').map(x => parseInt(x));
            const itemMinutes = (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
            if (itemMinutes <= nowMinutes && (nowMinutes - itemMinutes) < 60) activeIndex = idx;
            if (itemMinutes > nowMinutes && nextIndex === -1) nextIndex = idx;
        });

        // Render for old table structure
        if (tbody) {
            tbody.innerHTML = '';
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5"><div class="no-data"><i class="bi bi-calendar-x icon"></i><div>No classes scheduled today</div></div></td></tr>`;
            }

            list.forEach((item, idx) => {
                const isPending = item.st === "Pending";
                const isPresent = item.st === "Present" || item.st === "Late";
                const isAbsent = item.st === "Absent";
                const isActive = idx === activeIndex;
                const isNext = idx === nextIndex;

                let statusBadge = 'bg-secondary';
                let statusText = 'Pending';
                if (isPresent) {
                    statusBadge = 'bg-success';
                    statusText = item.st;
                } else if (isAbsent) {
                    statusBadge = 'bg-danger';
                    statusText = 'Absent';
                }

                tbody.innerHTML += `
                    <tr class="${isActive ? 'table-primary' : ''}">
                        <td class="fw-bold text-secondary">${item.t}${isActive ? '<small class="text-success"> (Ongoing)</small>' : ''}</td>
                        <td><div class="fw-bold">${item.s}${isNext ? ' <small class="text-muted">(Next)</small>' : ''}</div><small class="text-muted"><i class="bi bi-geo-alt"></i> ${item.r}</small></td>
                        <td><span class="badge ${statusBadge} rounded-pill badge-status">${statusText}</span></td>
                        <td class="small text-muted loc-info">-</td>
                        <td class="text-end">
                            <button class="btn ${isPending ? 'btn-primary' : (isPresent ? 'btn-success' : 'btn-secondary')} btn-sm rounded-pill px-3" ${!isPending ? 'disabled' : ''} onclick="initAtt('${item.s}',this)">
                                ${isPending ? 'Mark' : (isPresent ? '<i class="bi bi-check2"></i> Marked' : 'Missed')}
                            </button>
                        </td>
                    </tr>`;
            });
        }

        // Render for new Mindo-style card structure
        if (scheduleList) {
            scheduleList.innerHTML = '';
            if (list.length === 0) {
                scheduleList.innerHTML = `<div class="report-item"><span class="report-icon" style="background: linear-gradient(135deg, #e8e8e8, #d0d0d0);"><i class="bi bi-calendar-x"></i></span><div class="report-content"><span class="report-title">No Classes Today</span><span class="report-subtitle">Enjoy your day off!</span></div></div>`;
            }

            list.slice(0, 5).forEach((item, idx) => {
                const isPending = item.st === "Pending";
                const isPresent = item.st === "Present" || item.st === "Late";
                const isAbsent = item.st === "Absent";
                const isActive = idx === activeIndex;
                const isNext = idx === nextIndex;

                let statusColor = '#8B7FD8'; // Default pending
                let statusText = 'Pending';
                let statusClass = 'status-pending';

                if (isPresent) {
                    statusColor = '#4ade80';
                    statusText = item.st;
                    statusClass = 'status-completed';
                } else if (isAbsent) {
                    statusColor = '#ff6b6b';
                    statusText = 'Absent';
                    statusClass = 'status-absent';
                }

                if (isActive) {
                    statusColor = '#fbbf24';
                    statusText = 'Ongoing';
                }
                if (isNext && isPending) {
                    statusText = 'Next Up';
                    statusClass = 'status-next';
                }

                scheduleList.innerHTML += `
                    <div class="report-item ${isActive ? 'active-class' : ''}">
                        <span class="report-icon" style="background: linear-gradient(135deg, ${statusColor}, ${statusColor}88);">
                            <i class="bi bi-book"></i>
                        </span>
                        <div class="report-content">
                            <span class="report-title">${item.s}</span>
                            <span class="report-subtitle">${item.t} • ${item.r}${item.faculty ? ` • ${item.faculty}` : ''}</span>
                        </div>
                        <span class="report-status ${statusClass}">${statusText}</span>
                    </div>`;
            });
        }

        const nextEl = document.getElementById('nextUp');
        if (nextEl) {
            if (nextIndex !== -1 && list[nextIndex]) {
                nextEl.innerHTML = `<div class="fw-bold">${list[nextIndex].s}</div><div class="small text-muted">${list[nextIndex].t} • ${list[nextIndex].r}</div>`;
            } else {
                nextEl.innerHTML = `<div class="text-muted small">No more classes today</div>`;
            }
        }

        // Update floating stats for new Mindo style
        updateFloatingStats();
    }

    // Update floating stats on the dashboard
    function updateFloatingStats() {
        // Get elements
        const todayEl = document.getElementById('todayAttendance');
        const monthlyEl = document.getElementById('monthlyAttendance');
        const overallEl = document.getElementById('overallAttendance');
        const statusEl = document.getElementById('attendanceStatus');
        const lowSubjectsEl = document.getElementById('lowSubjectsCount');

        // Calculate from actual report data
        const subjects = reportData.overall?.s || reportData.weekly?.s || [];
        let totalAttended = 0, totalClasses = 0, lowSubjects = 0;

        subjects.forEach(s => {
            totalAttended += s.a || 0;
            totalClasses += s.t || 0;
            const pct = s.t > 0 ? Math.round((s.a / s.t) * 100) : 0;
            if (pct < 75) lowSubjects++;
        });

        // Calculate overall percentage
        const overallPercent = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

        // Update today's attendance (from schedule)
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let today = days[new Date().getDay()];
        if (today === "Sunday") today = "Monday";
        const todayClasses = weeklySchedule[today] || [];
        const attended = todayClasses.filter(c => c.st !== "Pending").length;
        const todayTotal = todayClasses.length;

        // Update UI elements
        if (todayEl) {
            todayEl.textContent = `${attended}/${todayTotal}`;
        }

        if (monthlyEl) {
            monthlyEl.textContent = `${overallPercent}`;
        }

        if (overallEl) {
            overallEl.textContent = overallPercent;
        }

        if (statusEl) {
            if (overallPercent >= 75) {
                statusEl.textContent = 'Good';
                statusEl.style.color = 'var(--success-green)';
            } else if (overallPercent >= 60) {
                statusEl.textContent = 'Standard';
                statusEl.style.color = 'var(--warning-orange)';
            } else {
                statusEl.textContent = 'Low';
                statusEl.style.color = 'var(--danger-red)';
            }
        }

        if (lowSubjectsEl) {
            lowSubjectsEl.textContent = lowSubjects;
        }

        // Update chart badge
        const chartBadge = document.getElementById('chartBadge');
        if (chartBadge) {
            const improvement = reportData.weekly?.d ?
                Math.max(...reportData.weekly.d) - Math.min(...reportData.weekly.d) : 0;
            chartBadge.innerHTML = `${overallPercent}% Avg<span>This period</span>`;
        }
    }

    // RENDER FULL TIMETABLE WITH COMPLETE DETAILS IN CALENDAR TABLE FORMAT
    function renderTimetable() {
        const container = document.getElementById('timetableGrid');
        const mobileContainer = document.getElementById('timetableMobileTabs');

        // Clear previous content
        if (container) container.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';

        // Check if we have timetable data
        if (!fullTimetable || Object.keys(fullTimetable).length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <div class="text-muted">
                            <i class="bi bi-calendar-x fs-1 d-block mb-3"></i>
                            <p class="fw-bold">No timetable data available</p>
                            <small>Please contact your administrator to set up your class schedule</small>
                        </div>
                    </div>`;
            }
            return;
        }

        // Days for display
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Group entries by day from weeklySchedule
        const groupedByDay = {};
        days.forEach(day => {
            groupedByDay[day] = weeklySchedule[day] || [];
        });

        // Sort each day's entries by start time
        Object.keys(groupedByDay).forEach(day => {
            groupedByDay[day].sort((a, b) => (a.t || '').localeCompare(b.t || ''));
        });

        // Desktop Calendar Table View
        if (container) {
            const batchName = user.batch?.name || user.batchName || user.batch || 'N/A';

            let html = `
                <div class="timetable-calendar-wrapper">
                    <div class="timetable-calendar-header mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <h5 class="mb-0 fw-bold" style="color: var(--primary-purple);">
                            <i class="bi bi-calendar3 me-2"></i>Timetable: ${batchName}
                        </h5>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge" style="background: var(--light-lavender); color: var(--text-primary);">
                                <i class="bi bi-mortarboard me-1"></i>${user.degree || 'BE'} ${user.branch || 'CSE'} - Sem ${user.semester || '1'}
                            </span>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-bordered timetable-table">
                            <thead>
                                <tr style="background: linear-gradient(135deg, var(--primary-purple), var(--secondary-purple));">
                                    <th class="text-white" style="width: 120px;">DAY</th>
                                    <th class="text-white">CLASSES</th>
                                </tr>
                            </thead>
                            <tbody>`;

            days.forEach(day => {
                const entries = groupedByDay[day];
                const hasClasses = entries.length > 0;

                html += `
                    <tr>
                        <td class="fw-bold align-middle day-cell" style="background: linear-gradient(135deg, var(--light-lavender), white);">
                            <div class="d-flex align-items-center gap-2">
                                <span>${day}</span>
                            </div>
                        </td>
                        <td class="classes-cell">`;

                if (!hasClasses) {
                    html += '<span class="text-muted fst-italic">No classes</span>';
                } else {
                    html += '<div class="d-flex flex-wrap gap-2">';
                    entries.forEach(entry => {
                        const subjectName = entry.s || entry.subjectName || 'Subject';
                        const teacherName = entry.faculty || entry.teacherName || '';
                        const startTime = entry.t || entry.startTime || '';
                        const endTime = entry.endTime || '';
                        const room = entry.r || entry.room || '';

                        html += `
                            <div class="timetable-class-card">
                                <div class="class-time">${startTime}${endTime ? ' - ' + endTime : ''}</div>
                                <div class="class-name">${subjectName}</div>
                                ${room ? `<div class="class-room"><i class="bi bi-geo-alt"></i> ${room}</div>` : ''}
                                ${teacherName ? `<div class="class-teacher"><i class="bi bi-person"></i> ${teacherName}</div>` : ''}
                            </div>`;
                    });
                    html += '</div>';
                }

                html += '</td></tr>';
            });

            html += '</tbody></table></div></div>';
            container.innerHTML = html;
        }

        // Mobile view with tabs
        if (mobileContainer) {
            days.forEach((day, idx) => {
                const isActive = idx === 0;
                const entries = groupedByDay[day];

                let mHtml = `
                    <div class="tab-pane fade ${isActive ? 'show active' : ''}" id="tab-${day.toLowerCase().slice(0, 3)}">
                        <div class="card border-0 shadow-sm">
                            <div class="card-header text-white" style="background: linear-gradient(135deg, var(--primary-purple), var(--secondary-purple)); padding: 1rem;">
                                <h5 class="mb-0 fw-bold">
                                    <i class="bi bi-calendar-day me-2"></i>${day}
                                </h5>
                            </div>
                            <div class="card-body p-0">`;

                if (entries.length === 0) {
                    mHtml += '<div class="p-4 text-center text-muted fst-italic">No classes scheduled</div>';
                } else {
                    entries.forEach((entry, idx) => {
                        const bgColor = idx % 2 === 0 ? 'white' : 'rgba(232, 228, 249, 0.3)';
                        mHtml += `
                            <div class="p-3 border-bottom" style="background: ${bgColor};">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <span class="fw-bold" style="color: var(--primary-purple);">${entry.s || 'Subject'}</span>
                                    <span class="badge" style="background: var(--primary-purple); color: white;">${entry.t || ''}</span>
                                </div>
                                <div class="small text-muted">
                                    <div class="d-flex flex-wrap gap-3">
                                        ${entry.r ? `<span><i class="bi bi-geo-alt me-1"></i>${entry.r}</span>` : ''}
                                        ${entry.endTime ? `<span><i class="bi bi-clock me-1"></i>${entry.t} - ${entry.endTime}</span>` : ''}
                                    </div>
                                    ${entry.faculty ? `<div class="mt-1"><i class="bi bi-person me-1"></i>${entry.faculty}</div>` : ''}
                                </div>
                            </div>`;
                    });
                }

                mHtml += '</div></div></div>';
                mobileContainer.innerHTML += mHtml;
            });
        }
    }

    // ATTENDANCE & GEO
    window.initAtt = function (sub, btn) {
        currentButton = btn;
        document.getElementById('modalSubject').innerText = sub;
        document.getElementById('cameraContainer').style.display = 'none';
        document.getElementById('locationStep').style.display = 'block';
        document.getElementById('errorMsg').classList.add('d-none');
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('photo').style.display = 'none';
        document.getElementById('videoElement').style.display = 'block';
        modalObj.show();
        verifyLoc();
    };

    function verifyLoc() {
        const spin = document.getElementById('locSpinner');
        const txt = document.getElementById('locStatusText');
        if (!navigator.geolocation) { showError("GPS Missing"); return; }

        navigator.geolocation.getCurrentPosition(pos => {
            const dist = getDist(pos.coords.latitude, pos.coords.longitude, COLLEGE_LAT, COLLEGE_LNG);
            document.getElementById('distanceDisplay').innerText = `Dist: ${Math.round(dist)}m`;

            if (dist <= ALLOWED_RADIUS) {
                spin.className = "bi bi-check-circle-fill text-success fs-5";
                txt.className = "text-success fw-bold"; txt.innerText = "Location Verified!";
                setTimeout(startCam, 1000);
            } else {
                spin.className = "bi bi-x-circle-fill text-danger fs-5";
                txt.className = "text-danger fw-bold"; txt.innerText = "Outside Geofence";
                showError(`Too far (${Math.round(dist)}m). Move inside campus.`);
            }
        }, () => showError("GPS Denied"));
    }

    function getDist(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function startCam() {
        document.getElementById('locationStep').style.display = 'none';
        document.getElementById('cameraContainer').style.display = 'block';
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            document.getElementById('videoElement').srcObject = videoStream;
        }
        catch { showError("Cam Access Denied"); }
    }

    window.takeSnapshot = function () {
        const v = document.getElementById('videoElement');
        const c = document.getElementById('canvas');
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        document.getElementById('photo').src = c.toDataURL('image/png');
        v.style.display = 'none';
        document.getElementById('photo').style.display = 'block';
        document.getElementById('submitBtn').disabled = false;
    };

    window.finalizeAttendance = function () {
        const r = currentButton.closest('tr');
        r.querySelector('.badge-status').className = "badge bg-success rounded-pill badge-status";
        r.querySelector('.badge-status').innerText = "Present";
        r.querySelector('.loc-info').innerHTML = `<i class="bi bi-geo-fill text-success"></i> Verified`;
        currentButton.className = "btn btn-success btn-sm rounded-pill px-3";
        currentButton.innerHTML = '<i class="bi bi-check2"></i> Marked';
        currentButton.disabled = true;

        const subj = document.getElementById('modalSubject').innerText || 'Subject';
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        activityLog.unshift({ t: timeStr, msg: `Marked Present in ${subj}` });
        if (activityLog.length > 10) activityLog.pop();
        attendanceHistory.unshift({ date: now.toISOString().slice(0, 10), subject: subj, status: 'Present' });
        if (attendanceHistory.length > 50) attendanceHistory.pop();
        updateActivityFeed();
        addNotification(`${subj} marked present at ${timeStr}`);

        // Reload attendance data from server to get updated stats
        loadAttendanceData().then(() => {
            loadDashboardSchedule(); // Refresh schedule with new status
        });

        // show animated success feedback, vibrate on supported devices
        showSuccessMessage('Marked Present', () => {
            populateAttendanceHistory();
            closeCamera();
        });
    };

    window.closeCamera = function () {
        if (videoStream) videoStream.getTracks().forEach(t => t.stop());
        modalObj.hide();
    };

    function showError(m) {
        const e = document.getElementById('errorMsg');
        e.innerText = m;
        e.classList.remove('d-none');
    }

    // Generic chart creator
    const createChart = (canvasId, type, data, options = {}) => new Chart(document.getElementById(canvasId), Object.assign({ type, data }, options));

    // UPDATED REPORTS FUNCTION
    window.updateReport = function (type, btn) {
        // Update button states
        btn.parentElement.querySelectorAll('.btn, .report-filter-btn').forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-outline-primary');
        });
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'active');

        const d = reportData[type];
        if (!d) {
            console.warn('No report data for type:', type);
            return;
        }

        // 1. Update Trend Chart
        const trendCanvas = document.getElementById('trendChart');
        if (trendCanvas) {
            if (trendChart) trendChart.destroy();
            trendChart = new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: d.l || [],
                    datasets: [{
                        label: 'Attendance %',
                        data: d.d || [],
                        borderColor: '#8B7FD8',
                        backgroundColor: 'rgba(139, 127, 216, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#8B7FD8',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { beginAtZero: true, max: 100, ticks: { callback: val => val + '%' } }
                    }
                }
            });
        }

        // 2. Update Subject Chart
        const subjectCanvas = document.getElementById('subjectChart');
        if (subjectCanvas && d.s && d.s.length > 0) {
            if (subChart) subChart.destroy();
            const colors = ['#8B7FD8', '#4ade80', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'];
            subChart = new Chart(subjectCanvas, {
                type: 'doughnut',
                data: {
                    labels: d.s.map(x => x.n),
                    datasets: [{
                        data: d.s.map(x => x.t > 0 ? Math.round((x.a / x.t) * 100) : 0),
                        backgroundColor: colors.slice(0, d.s.length),
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 15, font: { size: 11 } } },
                        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}%` } }
                    }
                }
            });
        }

        // 3. Populate Detailed Table
        const tbody = document.getElementById('reportTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (!d.s || d.s.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-4 d-block mb-2"></i>No attendance data available</td></tr>`;
            } else {
                d.s.forEach(sub => {
                    const total = sub.t || 0;
                    const attended = sub.a || 0;
                    const absent = total - attended;
                    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
                    const statusBadge = pct >= 75
                        ? '<span class="badge bg-success">Safe</span>'
                        : '<span class="badge bg-danger">Low</span>';

                    tbody.innerHTML += `
                        <tr>
                            <td class="fw-bold"><i class="bi bi-book me-2 text-primary"></i>${sub.n}</td>
                            <td class="text-center">${total}</td>
                            <td class="text-center text-success">${attended}</td>
                            <td class="text-center text-danger">${absent}</td>
                            <td class="fw-bold text-center ${pct < 75 ? 'text-danger' : 'text-success'}">${pct}%</td>
                            <td class="text-center">${statusBadge}</td>
                        </tr>
                    `;
                });
            }
        }
    };

    // Activity & Notifications helpers
    function updateActivityFeed() {
        const ul = document.getElementById('activityFeed');
        ul.innerHTML = '';
        const items = activityLog.slice(0, 3);
        if (items.length === 0) { ul.innerHTML = '<li class="list-group-item">No recent activity</li>'; return; }
        items.forEach(it => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `<div class="d-flex justify-content-between"><div>${it.msg}</div><div class="text-muted small">${it.t}</div></div>`;
            ul.appendChild(li);
        });
    }

    function addNotification(msg) {
        notifications.unshift({ t: new Date().toLocaleDateString(), msg });
        if (notifications.length > 20) notifications.pop();
        showNotifications();
    }

    function showNotifications() {
        const list = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        list.innerHTML = '';
        if (notifications.length === 0) {
            list.innerHTML = '<div class="small text-muted p-2">No notifications</div>';
            badge.innerText = '0';
            return;
        }
        notifications.slice(0, 8).forEach(n => {
            const el = document.createElement('div');
            el.className = 'px-2 py-1';
            el.innerHTML = `<div class="small"><strong>${n.msg}</strong></div><div class="small text-muted">${n.t}</div><hr class="my-1">`;
            list.appendChild(el);
        });
        badge.innerText = notifications.length;
    }

    window.clearNotifications = function () {
        notifications.length = 0;
        showNotifications();
    };

    // Reports helpers: download CSV and show history
    window.exportCSV = function () {
        const rows = [['Date', 'Subject', 'Status']];
        attendanceHistory.forEach(r => rows.push([r.date, r.subject, r.status]));
        let csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_history.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    function populateAttendanceHistory() {
        let hist = document.getElementById('attendanceHistoryList');
        if (!hist) {
            // Find reports section container
            const reportsSection = document.getElementById('reports-section');
            const reportCard = reportsSection?.querySelector('.content-card:last-of-type');

            if (reportCard) {
                const div = document.createElement('div');
                div.className = 'content-card mt-4';
                div.innerHTML = '<div class="d-flex justify-content-between align-items-center mb-3"><h6 class="mb-0 fw-bold"><i class="bi bi-clock-history me-2"></i>Attendance History</h6><button class="btn btn-sm btn-outline-secondary" onclick="exportCSV()"><i class="bi bi-download me-1"></i>Download CSV</button></div><ul id="attendanceHistoryList" class="list-group small"></ul>';
                reportCard.after(div);
                hist = document.getElementById('attendanceHistoryList');
            }
        }

        if (!hist) {
            console.warn('Attendance history container not found');
            return;
        }

        hist.innerHTML = '';
        if (attendanceHistory.length === 0) {
            hist.innerHTML = '<li class="list-group-item"><div class="text-center py-3 text-muted"><i class="bi bi-clock-history fs-4 d-block mb-2"></i><div>No attendance history</div></div></li>';
            return;
        }
        attendanceHistory.slice(0, 10).forEach(h => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            const statusColor = h.status === 'present' || h.status === 'Present' ? 'text-success' : (h.status === 'late' || h.status === 'Late' ? 'text-warning' : 'text-danger');
            li.innerHTML = `<div><i class="bi bi-book me-2"></i>${h.subject}</div><div class="text-muted small">${h.date} • <span class="${statusColor} fw-semibold">${h.status}</span></div>`;
            hist.appendChild(li);
        });
    }

    // Success overlay helper
    function showSuccessMessage(text, cb) {
        try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) { }
        const wrap = document.createElement('div');
        wrap.className = 'success-overlay';
        wrap.innerHTML = `<div class="check-pop show"><div class="check"><i class="bi bi-check2-circle"></i></div><div class="text"><strong>${text}</strong></div></div>`;
        document.body.appendChild(wrap);
        setTimeout(() => { wrap.classList.add('removing'); }, 1200);
        setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); if (cb) cb(); }, 1500);
    }

    // Render profile
    function renderProfile() {
        try {
            // Update profile photo
            const profilePhoto = document.getElementById('profilePhoto');
            if (profilePhoto) {
                profilePhoto.src = studentProfile.photo || user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';
            }

            // Update name
            const pfName = document.getElementById('pfName');
            if (pfName) pfName.textContent = studentProfile.name || user.name || 'Student';

            // Update course info
            const pfCourse = document.getElementById('pfCourse');
            if (pfCourse) {
                const degree = studentProfile.degree || user.degree || 'BE';
                const branch = studentProfile.branch || user.branch || 'CSE';
                const semester = studentProfile.semester || user.semester || '1';
                pfCourse.textContent = `${degree} - ${branch} • ${semester}${getOrdinalSuffix(semester)} Sem`;
            }

            // Update personal info
            const pfDOB = document.getElementById('pfDOB');
            if (pfDOB) {
                const dob = studentProfile.dob || user.dateOfBirth;
                pfDOB.textContent = dob ? new Date(dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-';
            }

            const pfGender = document.getElementById('pfGender');
            if (pfGender) pfGender.textContent = studentProfile.gender || user.gender || '-';

            const pfBlood = document.getElementById('pfBlood');
            if (pfBlood) pfBlood.textContent = studentProfile.blood || user.bloodGroup || '-';

            // Family info
            const pfFather = document.getElementById('pfFather');
            if (pfFather) pfFather.textContent = studentProfile.father || user.fatherName || '-';

            const pfMother = document.getElementById('pfMother');
            if (pfMother) pfMother.textContent = studentProfile.mother || user.motherName || '-';

            // Academic identifiers
            const pfAdmission = document.getElementById('pfAdmission');
            if (pfAdmission) pfAdmission.textContent = studentProfile.admissionNo || user.admissionNumber || '-';

            const pfRoll = document.getElementById('pfRoll');
            if (pfRoll) pfRoll.textContent = studentProfile.rollNo || user.rollNumber || '-';

            const pfReg = document.getElementById('pfReg');
            if (pfReg) pfReg.textContent = studentProfile.regId || user.registrationId || '-';

            // Course info
            const pfDegree = document.getElementById('pfDegree');
            if (pfDegree) pfDegree.textContent = studentProfile.degree || user.degree || 'BE';

            const pfBranch = document.getElementById('pfBranch');
            if (pfBranch) pfBranch.textContent = studentProfile.branch || user.branch || 'CSE';

            const pfSemester = document.getElementById('pfSemester');
            if (pfSemester) pfSemester.textContent = (studentProfile.semester || user.semester || '1') + getOrdinalSuffix(studentProfile.semester || user.semester || 1);

            const pfBatch = document.getElementById('pfBatch');
            if (pfBatch) pfBatch.textContent = studentProfile.batch || user.batch || '-';

            // Contact info
            const pfEmailCollege = document.getElementById('pfEmailCollege');
            if (pfEmailCollege) pfEmailCollege.textContent = studentProfile.collegeEmail || user.email || '-';

            const pfEmailPersonal = document.getElementById('pfEmailPersonal');
            if (pfEmailPersonal) pfEmailPersonal.textContent = studentProfile.personalEmail || user.personalEmail || '-';

            const pfPhone = document.getElementById('pfPhone');
            if (pfPhone) pfPhone.textContent = studentProfile.phone || user.phone || '-';

            // Address
            const pfAddressCurrent = document.getElementById('pfAddressCurrent');
            if (pfAddressCurrent) pfAddressCurrent.textContent = studentProfile.addressCurrent || user.currentAddress || '-';

            const pfAddressPermanent = document.getElementById('pfAddressPermanent');
            if (pfAddressPermanent) pfAddressPermanent.textContent = studentProfile.addressPermanent || user.permanentAddress || '-';

        } catch (e) {
            console.warn('Profile render error', e);
        }
    }

    function checkLowAttendance() {
        const low = reportData.overall.s.filter(s => Math.round((s.a / s.t) * 100) < 75);
        const banner = document.getElementById('lowAttendanceBanner');
        const text = document.getElementById('lowAttendanceText');
        if (low.length > 0) {
            banner.classList.remove('d-none');
            text.innerText = `Low attendance in: ${low.map(x => x.n).join(', ')}. Please improve to avoid penalties.`;
            addNotification(`Low attendance in ${low.map(x => x.n).join(', ')}`);
        } else banner.classList.add('d-none');
    }

    window.toggleDarkMode = function (el) {
        const on = el.checked;
        if (on) document.body.classList.add('bg-dark', 'text-light');
        else document.body.classList.remove('bg-dark', 'text-light');
        localStorage.setItem('darkMode', on ? '1' : '0');
    };

    window.saveSettings = async function () {
        try {
            const emailOn = document.getElementById('emailNotifToggle')?.checked || false;
            const darkModeOn = document.getElementById('darkModeToggle')?.checked || false;

            // Save to localStorage
            localStorage.setItem('emailNotif', emailOn ? '1' : '0');
            localStorage.setItem('darkMode', darkModeOn ? '1' : '0');

            // Save to backend
            await saveUserSettings({
                preferences: {
                    emailNotifications: emailOn,
                    darkMode: darkModeOn
                }
            });

            // Update local user object
            user.preferences = { emailNotifications: emailOn, darkMode: darkModeOn };
            localStorage.setItem('user', JSON.stringify(user));

            // Show success notification
            showToast('Settings saved successfully!', 'success');

            // Close modal if open
            const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
            if (modal) modal.hide();
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Failed to save settings. Please try again.', 'error');
        }
    };

    // Setup Edit Profile Functionality
    function setupEditProfile() {
        // Profile image click handler
        const profilePhoto = document.getElementById('profilePhoto');
        if (profilePhoto) {
            profilePhoto.style.cursor = 'pointer';
            profilePhoto.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const result = await updateProfileImage(file);
                            if (result.profileImage) {
                                profilePhoto.src = result.profileImage;
                                // Update all profile images
                                document.querySelectorAll('.profile-img, .avatar-img').forEach(img => {
                                    img.src = result.profileImage;
                                });
                                showToast('Profile image updated successfully!', 'success');
                            }
                        } catch (error) {
                            showToast('Failed to update profile image', 'error');
                        }
                    }
                };
                input.click();
            });
        }

        // Edit profile button handler
        const editProfileBtn = document.querySelector('.btn-edit-profile, #editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', openEditProfileModal);
        }
    }

    // Open Edit Profile Modal
    function openEditProfileModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('editProfileModal');
        if (existingModal) existingModal.remove();

        // Create comprehensive edit profile modal
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = `
            <div class="modal fade" id="editProfileModal" tabindex="-1" aria-labelledby="editProfileModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #8B7FD8 0%, #B8A4FF 100%);">
                            <h5 class="modal-title text-white" id="editProfileModalLabel">
                                <i class="bi bi-pencil-square me-2"></i>Edit Profile
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editProfileForm">
                                <!-- Personal Information Section -->
                                <h6 class="text-primary fw-bold mb-3 border-bottom pb-2">
                                    <i class="bi bi-person me-2"></i>Personal Information
                                </h6>
                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <label class="form-label">Full Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="editName" value="${user.name || ''}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Phone Number</label>
                                        <input type="tel" class="form-control" id="editPhone" value="${user.phone || ''}" placeholder="e.g., +91 9876543210">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Personal Email</label>
                                        <input type="email" class="form-control" id="editPersonalEmail" value="${user.personalEmail || ''}" placeholder="your.email@gmail.com">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Date of Birth</label>
                                        <input type="date" class="form-control" id="editDOB" value="${user.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Gender</label>
                                        <select class="form-select" id="editGender">
                                            <option value="">Select Gender</option>
                                            <option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option>
                                            <option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option>
                                            <option value="Other" ${user.gender === 'Other' ? 'selected' : ''}>Other</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Blood Group</label>
                                        <select class="form-select" id="editBloodGroup">
                                            <option value="">Select Blood Group</option>
                                            <option value="A+" ${user.bloodGroup === 'A+' ? 'selected' : ''}>A+</option>
                                            <option value="A-" ${user.bloodGroup === 'A-' ? 'selected' : ''}>A-</option>
                                            <option value="B+" ${user.bloodGroup === 'B+' ? 'selected' : ''}>B+</option>
                                            <option value="B-" ${user.bloodGroup === 'B-' ? 'selected' : ''}>B-</option>
                                            <option value="O+" ${user.bloodGroup === 'O+' ? 'selected' : ''}>O+</option>
                                            <option value="O-" ${user.bloodGroup === 'O-' ? 'selected' : ''}>O-</option>
                                            <option value="AB+" ${user.bloodGroup === 'AB+' ? 'selected' : ''}>AB+</option>
                                            <option value="AB-" ${user.bloodGroup === 'AB-' ? 'selected' : ''}>AB-</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Family Information Section -->
                                <h6 class="text-primary fw-bold mb-3 border-bottom pb-2">
                                    <i class="bi bi-people me-2"></i>Family Information
                                </h6>
                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <label class="form-label">Father's Name</label>
                                        <input type="text" class="form-control" id="editFatherName" value="${user.fatherName || ''}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Mother's Name</label>
                                        <input type="text" class="form-control" id="editMotherName" value="${user.motherName || ''}">
                                    </div>
                                </div>

                                <!-- Academic Information Section -->
                                <h6 class="text-primary fw-bold mb-3 border-bottom pb-2">
                                    <i class="bi bi-mortarboard me-2"></i>Academic Information
                                </h6>
                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <label class="form-label">Admission Number</label>
                                        <input type="text" class="form-control" id="editAdmissionNumber" value="${user.admissionNumber || ''}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">University Registration ID</label>
                                        <input type="text" class="form-control" id="editRegistrationId" value="${user.registrationId || ''}">
                                    </div>
                                </div>

                                <!-- Address Section -->
                                <h6 class="text-primary fw-bold mb-3 border-bottom pb-2">
                                    <i class="bi bi-geo-alt me-2"></i>Address Information
                                </h6>
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label">Current Address</label>
                                        <textarea class="form-control" id="editCurrentAddress" rows="2" placeholder="Enter your current residential address">${user.currentAddress || ''}</textarea>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Permanent Address</label>
                                        <textarea class="form-control" id="editPermanentAddress" rows="2" placeholder="Enter your permanent address">${user.permanentAddress || ''}</textarea>
                                        <div class="form-check mt-2">
                                            <input class="form-check-input" type="checkbox" id="sameAsCurrentAddress" onchange="if(this.checked) document.getElementById('editPermanentAddress').value = document.getElementById('editCurrentAddress').value;">
                                            <label class="form-check-label small" for="sameAsCurrentAddress">Same as current address</label>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-lg me-1"></i>Cancel
                            </button>
                            <button type="button" class="btn btn-primary" onclick="submitProfileUpdate()" style="background: linear-gradient(135deg, #8B7FD8, #B8A4FF); border: none;">
                                <i class="bi bi-check-lg me-1"></i>Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
        modal.show();
    }

    // Submit Profile Update
    window.submitProfileUpdate = async function () {
        try {
            const submitBtn = document.querySelector('#editProfileModal .btn-primary');
            const originalText = submitBtn?.innerHTML;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            }

            const updateData = {
                name: document.getElementById('editName')?.value?.trim(),
                phone: document.getElementById('editPhone')?.value?.trim(),
                personalEmail: document.getElementById('editPersonalEmail')?.value?.trim(),
                dateOfBirth: document.getElementById('editDOB')?.value,
                gender: document.getElementById('editGender')?.value,
                bloodGroup: document.getElementById('editBloodGroup')?.value,
                fatherName: document.getElementById('editFatherName')?.value?.trim(),
                motherName: document.getElementById('editMotherName')?.value?.trim(),
                admissionNumber: document.getElementById('editAdmissionNumber')?.value?.trim(),
                registrationId: document.getElementById('editRegistrationId')?.value?.trim(),
                currentAddress: document.getElementById('editCurrentAddress')?.value?.trim(),
                permanentAddress: document.getElementById('editPermanentAddress')?.value?.trim()
            };

            // Validate required fields
            if (!updateData.name) {
                showToast('Name is required', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }

            // Remove empty/null values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === '' || updateData[key] === null || updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            await saveUserSettings(updateData);

            // Update local user object
            Object.assign(user, updateData);
            localStorage.setItem('user', JSON.stringify(user));

            // Update studentProfile object
            studentProfile = {
                ...studentProfile,
                name: updateData.name || studentProfile.name,
                phone: updateData.phone || studentProfile.phone,
                personalEmail: updateData.personalEmail || studentProfile.personalEmail,
                dob: updateData.dateOfBirth || studentProfile.dob,
                gender: updateData.gender || studentProfile.gender,
                blood: updateData.bloodGroup || studentProfile.blood,
                father: updateData.fatherName || studentProfile.father,
                mother: updateData.motherName || studentProfile.mother,
                admissionNo: updateData.admissionNumber || studentProfile.admissionNo,
                regId: updateData.registrationId || studentProfile.regId,
                addressCurrent: updateData.currentAddress || studentProfile.addressCurrent,
                addressPermanent: updateData.permanentAddress || studentProfile.addressPermanent
            };

            // Re-render profile
            renderProfile();
            updateStudentInfo();

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
            if (modal) modal.hide();

            showToast('Profile updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Failed to update profile. Please try again.', 'error');
        } finally {
            const submitBtn = document.querySelector('#editProfileModal .btn-primary');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Changes';
            }
        }
    };

    // Logout function
    window.handleLogout = function (event) {
        if (event) event.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
    };

    // Change Password Modal
    window.openChangePasswordModal = function () {
        // Remove existing modal if present
        const existingModal = document.getElementById('changePasswordModal');
        if (existingModal) existingModal.remove();

        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = `
            <div class="modal fade" id="changePasswordModal" tabindex="-1" aria-labelledby="changePasswordModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #8B7FD8 0%, #B8A4FF 100%);">
                            <h5 class="modal-title text-white" id="changePasswordModalLabel">
                                <i class="bi bi-shield-lock me-2"></i>Change Password
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Step 1: Request OTP -->
                            <div id="passwordStep1">
                                <div class="text-center mb-4">
                                    <div class="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" 
                                         style="width: 80px; height: 80px; background: linear-gradient(135deg, rgba(139, 127, 216, 0.2), rgba(184, 164, 255, 0.2));">
                                        <i class="bi bi-envelope-at fs-1" style="color: #8B7FD8;"></i>
                                    </div>
                                    <h5 class="fw-bold">Email Verification Required</h5>
                                    <p class="text-muted mb-0">We'll send a verification code to your email:</p>
                                    <p class="fw-semibold" style="color: #8B7FD8;">${user.email}</p>
                                </div>
                                <button type="button" class="btn btn-primary w-100" onclick="requestPasswordChangeOTP()" 
                                        style="background: linear-gradient(135deg, #8B7FD8, #B8A4FF); border: none;">
                                    <i class="bi bi-send me-2"></i>Send Verification Code
                                </button>
                            </div>

                            <!-- Step 2: Enter OTP and New Password -->
                            <div id="passwordStep2" style="display: none;">
                                <div class="alert alert-info d-flex align-items-center mb-4">
                                    <i class="bi bi-info-circle me-2"></i>
                                    <small>A 6-digit verification code has been sent to your email. It expires in 10 minutes.</small>
                                </div>
                                <form id="changePasswordForm">
                                    <div class="mb-3">
                                        <label class="form-label">Verification Code</label>
                                        <input type="text" class="form-control text-center fs-4 letter-spacing-2" id="otpCode" 
                                               maxlength="6" pattern="[0-9]{6}" required placeholder="000000"
                                               style="letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">New Password</label>
                                        <div class="input-group">
                                            <input type="password" class="form-control" id="newPassword" 
                                                   minlength="6" required placeholder="Enter new password">
                                            <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility('newPassword', this)">
                                                <i class="bi bi-eye"></i>
                                            </button>
                                        </div>
                                        <div class="form-text">Minimum 6 characters</div>
                                    </div>
                                    <div class="mb-4">
                                        <label class="form-label">Confirm New Password</label>
                                        <div class="input-group">
                                            <input type="password" class="form-control" id="confirmNewPassword" 
                                                   minlength="6" required placeholder="Confirm new password">
                                            <button class="btn btn-outline-secondary" type="button" onclick="togglePasswordVisibility('confirmNewPassword', this)">
                                                <i class="bi bi-eye"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="d-grid gap-2">
                                        <button type="submit" class="btn btn-primary" 
                                                style="background: linear-gradient(135deg, #8B7FD8, #B8A4FF); border: none;">
                                            <i class="bi bi-check-lg me-2"></i>Change Password
                                        </button>
                                        <button type="button" class="btn btn-outline-secondary" onclick="resendOTP()">
                                            <i class="bi bi-arrow-clockwise me-2"></i>Resend Code
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);

        // Setup form submission
        document.getElementById('changePasswordForm').addEventListener('submit', function (e) {
            e.preventDefault();
            verifyAndChangePassword();
        });

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
    };

    // Toggle password visibility
    window.togglePasswordVisibility = function (inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('bi-eye', 'bi-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('bi-eye-slash', 'bi-eye');
        }
    };

    // Request OTP for password change
    window.requestPasswordChangeOTP = async function () {
        const btn = document.querySelector('#passwordStep1 button');
        const originalHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

            const response = await apiRequest('/auth/request-password-change', {
                method: 'POST'
            });

            if (response.success) {
                document.getElementById('passwordStep1').style.display = 'none';
                document.getElementById('passwordStep2').style.display = 'block';
                showToast('Verification code sent to your email!', 'success');
            }
        } catch (error) {
            console.error('Error requesting OTP:', error);
            showToast(error.message || 'Failed to send verification code', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    // Resend OTP
    window.resendOTP = async function () {
        await requestPasswordChangeOTP();
    };

    // Verify OTP and change password
    window.verifyAndChangePassword = async function () {
        const otp = document.getElementById('otpCode').value.trim();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        // Validation
        if (otp.length !== 6) {
            showToast('Please enter a valid 6-digit verification code', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        const btn = document.querySelector('#changePasswordForm button[type="submit"]');
        const originalHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Changing...';

            const response = await apiRequest('/auth/verify-change-password', {
                method: 'POST',
                body: JSON.stringify({ otp, newPassword })
            });

            if (response.success) {
                // Update token if new one is provided
                if (response.token) {
                    localStorage.setItem('token', response.token);
                }

                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                if (modal) modal.hide();

                showToast('Password changed successfully!', 'success');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showToast(error.message || 'Failed to change password', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };

    // Update student name display
    const studentNameEl = document.querySelector('.fw-bold.text-dark.mb-1');
    if (studentNameEl && user.name) {
        studentNameEl.textContent = `Welcome, ${user.name.toUpperCase()}`;
    }

})();
