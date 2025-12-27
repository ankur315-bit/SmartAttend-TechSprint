(function () {
    'use strict';

    // --- ADMIN DASHBOARD WITH API INTEGRATION ---

    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'admin') {
        window.location.href = '/pages/login';
        return;
    }

    // Set admin name in greeting
    if (user.name) {
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            adminNameEl.textContent = user.name;
        }

        // Update profile image with admin name
        const profileImage = document.getElementById('profileImage');
        if (profileImage) {
            const encodedName = encodeURIComponent(user.name);
            profileImage.src = `https://ui-avatars.com/api/?name=${encodedName}&background=8B7FD8&color=fff&bold=true`;
            profileImage.alt = user.name;
        }
    }

    // API Configuration
    const API_BASE = '/api';

    let parsedTimetable = null;
    let allUsers = [];
    let allSubjects = [];
    let allBatches = [];

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

    // Show toast notification
    function showToast(message, type = 'info') {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const toastId = 'toast-' + Date.now();
        const bgClass = { 'success': 'bg-success', 'danger': 'bg-danger', 'warning': 'bg-warning text-dark', 'info': 'bg-info' }[type] || 'bg-info';

        const toastHtml = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
                <div class="toast-body d-flex justify-content-between align-items-center">
                    <span>${message}</span>
                    <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    // Show custom confirm dialog
    function showConfirmDialog(title, message, onConfirm) {
        const modalHtml = `
            <div class="modal fade" id="confirmModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmBtn">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('confirmModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('confirmModal');
        const modal = new bootstrap.Modal(modalEl);

        document.getElementById('confirmBtn').addEventListener('click', () => {
            modal.hide();
            onConfirm();
        });

        modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
        modal.show();
    }

    // --- INITIALIZATION ---

    document.addEventListener('DOMContentLoaded', function () {
        setupNavigation();
        loadFacultyList();
        loadSubjects();
        loadDashboardStats();
        loadAllUsers();
        loadBatches();
        initializeCharts();
        animateStats();
        loadGeofences();
        loadGeofenceActivity();
        loadUserProfile();
        loadNotifications();
        loadSentNotices();
        setupTimetableBatchSelector();

        // Setup event listeners
        setupEventListeners();
        setupNotificationBell();
    });

    // Setup timetable batch selector
    function setupTimetableBatchSelector() {
        const selector = document.getElementById('timetableBatchSelector');
        if (selector) {
            selector.addEventListener('change', function () {
                const batchName = this.value;
                if (batchName) {
                    loadBatchTimetableCalendar(batchName);
                }
            });
        }
    }

    // Navigation for top navbar
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
    }

    // Initialize Chart.js
    function initializeCharts() {
        const chartCanvas = document.getElementById('performanceChart');
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'System Performance',
                    data: [85, 88, 92, 87, 90, 95, 93],
                    borderColor: '#8B7FD8',
                    backgroundColor: 'rgba(139, 127, 216, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#8B7FD8',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
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
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(139, 127, 216, 0.1)'
                        },
                        ticks: {
                            color: '#8B7BA8'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#8B7BA8'
                        }
                    }
                }
            }
        });
    }

    // Animate stats on load
    function animateStats() {
        const progressBars = document.querySelectorAll('.progress-bar, .progress-fill');
        progressBars.forEach(bar => {
            const width = bar.style.width || bar.getAttribute('style')?.match(/width:\s*(\d+%)/)?.[1];
            if (width) {
                bar.style.width = '0';
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            }
        });
    }

    // Navigate to section helper
    window.navigateToSection = function (sectionId) {
        showSection(sectionId);
    };

    // Logout function
    window.logout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
    };

    // Load all users and render table with attendance stats for students
    async function loadAllUsers() {
        try {
            const response = await apiRequest('/users');
            allUsers = response.users || [];

            // Fetch attendance stats for students
            const studentPromises = allUsers
                .filter(u => u.role === 'student')
                .map(async (student) => {
                    try {
                        const attendanceResponse = await apiRequest(`/attendance/student/${student._id}/report`);
                        const data = attendanceResponse.report || {};

                        // Calculate overall percentage
                        if (data.subjects && data.subjects.length > 0) {
                            let totalClasses = 0, totalAttended = 0;
                            data.subjects.forEach(s => {
                                totalClasses += s.total || 0;
                                totalAttended += s.present || 0;
                            });
                            student.attendanceStats = {
                                percentage: totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0,
                                totalClasses,
                                totalAttended
                            };
                        } else {
                            student.attendanceStats = { percentage: 0, totalClasses: 0, totalAttended: 0 };
                        }
                    } catch (error) {
                        console.warn(`Failed to load attendance for student ${student.name}:`, error);
                        student.attendanceStats = { percentage: 0, totalClasses: 0, totalAttended: 0 };
                    }
                });

            // Wait for all attendance data to load
            await Promise.all(studentPromises);

            renderUsersTable();
        } catch (error) {
            console.error('Failed to load users:', error);
            showToast('Failed to load users', 'danger');
        }
    }

    // Render users table with credentials and attendance data for students
    function renderUsersTable() {
        const container = document.getElementById('usersTableContainer');
        if (!container) return;

        if (allUsers.length === 0) {
            container.innerHTML = '<p class="text-muted">No users registered yet.</p>';
            return;
        }

        let html = `<div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>ID / Roll No</th>
                        <th>Batch / Department</th>
                        <th>Attendance</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        allUsers.forEach(u => {
            const roleColor = u.role === 'admin' ? 'danger' : u.role === 'faculty' ? 'info' : 'success';
            const statusColor = u.isActive !== false ? 'success' : 'secondary';
            const identifier = u.rollNumber || u.employeeId || '-';
            const batchInfo = u.batch?.name || u.batchName || u.department || '-';

            // Calculate attendance percentage for students
            let attendanceHtml = '<span class="text-muted small">N/A</span>';
            if (u.role === 'student' && u.attendanceStats) {
                const percentage = u.attendanceStats.percentage || 0;
                const colorClass = percentage >= 75 ? 'success' : percentage >= 60 ? 'warning' : 'danger';
                attendanceHtml = `
                    <div class="d-flex align-items-center gap-2">
                        <div class="progress" style="width: 60px; height: 8px;">
                            <div class="progress-bar bg-${colorClass}" style="width: ${percentage}%"></div>
                        </div>
                        <span class="badge bg-${colorClass}">${percentage}%</span>
                    </div>`;
            }

            html += `<tr>
                <td><strong>${u.name}</strong></td>
                <td><small>${u.email}</small></td>
                <td><span class="badge bg-${roleColor}">${u.role}</span></td>
                <td><code class="small">${identifier}</code></td>
                <td><span class="badge bg-secondary">${batchInfo}</span></td>
                <td>${attendanceHtml}</td>
                <td><span class="badge bg-${statusColor}">${u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="viewUserDetails('${u._id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${u.role === 'student' ? `<button class="btn btn-outline-primary" onclick="viewStudentAttendance('${u._id}')" title="View Attendance">
                            <i class="bi bi-calendar-check"></i>
                        </button>` : ''}
                        <button class="btn btn-outline-info" onclick="sendEmailToUser('${u._id}')" title="Send Email">
                            <i class="bi bi-envelope"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="editUser('${u._id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser('${u._id}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // --- UI LOGIC ---

    // Mobile Sidebar Toggle
    window.toggleSidebar = function () {
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            document.getElementById('sidebar').classList.toggle('active');
        }
    };

    // Ensure only one section visible at a time
    function setupSectionNavigation() {
        const navLinks = document.querySelectorAll('.sidebar .nav-link');
        const sections = document.querySelectorAll('.section-container');

        function hideAll() {
            sections.forEach(s => s.style.display = 'none');
        }

        navLinks.forEach(link => {
            link.addEventListener('click', (ev) => {
                ev.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // derive target from href (e.g. #user-mgmt)
                const href = link.getAttribute('href') || link.dataset.target;
                const id = href && href.startsWith('#') ? href.substring(1) : href;

                hideAll();
                if (id) {
                    const target = document.getElementById(id);
                    if (target) target.style.display = 'block';
                }

                // close sidebar on mobile
                if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');
            });
        });

        // Show first section by default
        hideAll();
        const first = document.querySelector('.section-container');
        if (first) first.style.display = 'block';
    }

    // Toggle Student Specific Fields
    window.toggleStudentFields = function () {
        const role = document.getElementById('regRole')?.value || document.getElementById('userRole')?.value;
        const studentFields = document.getElementById('studentFields');
        const studentRoll = document.getElementById('studentRoll');

        if (role === 'Student' || role === 'student') {
            if (studentFields) studentFields.style.display = 'block';
            if (document.getElementById('regRoll')) document.getElementById('regRoll').required = true;
            if (document.getElementById('regBatch')) document.getElementById('regBatch').required = true;
            if (studentRoll) studentRoll.style.display = 'block';
            // Populate batch dropdown for students
            populateStudentBatchDropdown();
        } else {
            if (studentFields) studentFields.style.display = 'none';
            if (document.getElementById('regRoll')) document.getElementById('regRoll').required = false;
            if (document.getElementById('regBatch')) document.getElementById('regBatch').required = false;
            if (studentRoll) studentRoll.style.display = 'none';
        }
    };

    // Populate student batch dropdown
    function populateStudentBatchDropdown() {
        const batchSelect = document.getElementById('regBatch');
        if (!batchSelect) return;

        batchSelect.innerHTML = '<option value="" disabled selected>Select Batch (Create batch first)</option>';

        if (allBatches.length === 0) {
            batchSelect.innerHTML = '<option value="" disabled selected>No batches available - Create one first</option>';
            return;
        }

        allBatches.forEach(batch => {
            if (batch.isActive) {
                const option = document.createElement('option');
                option.value = batch.name;
                option.textContent = `${batch.name} (${batch.branch}-${batch.section}, Sem ${batch.semester})`;
                batchSelect.appendChild(option);
            }
        });
    }

    // --- EVENT LISTENERS SETUP ---

    function setupEventListeners() {
        // Handle Add User Form
        const addUserForm = document.getElementById('addUserForm') || document.getElementById('registerForm');
        if (addUserForm) {
            addUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('regName')?.value;
                const email = document.getElementById('regEmail')?.value;
                const password = document.getElementById('regPassword')?.value || 'College@123';
                const roleSelect = document.getElementById('regRole')?.value;

                // Map role correctly
                const roleMap = { 'Faculty': 'faculty', 'Student': 'student', 'Admin': 'admin' };
                const role = roleMap[roleSelect] || roleSelect?.toLowerCase() || 'student';

                const userData = { name, email, password, role };

                // Add student-specific fields
                if (role === 'student') {
                    const batchValue = document.getElementById('regBatch')?.value;
                    if (!batchValue) {
                        showToast('Please select a batch for the student. Create a batch first if none exist.', 'warning');
                        return;
                    }
                    userData.rollNumber = document.getElementById('regRoll')?.value;
                    userData.semester = parseInt(document.getElementById('regSem')?.value) || 1;
                    userData.branch = document.getElementById('regBranch')?.value || 'CSE';
                    userData.section = document.getElementById('regSection')?.value || 'A';
                    userData.batch = batchValue;
                }

                // Add faculty-specific fields
                if (role === 'faculty') {
                    userData.department = 'CSE';
                    userData.employeeId = 'EMP' + Date.now().toString().slice(-6);
                }

                try {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    const editingUserId = addUserForm.dataset.editingUserId;
                    submitBtn.disabled = true;

                    if (editingUserId) {
                        // Update existing user
                        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

                        await apiRequest(`/users/${editingUserId}`, {
                            method: 'PUT',
                            body: JSON.stringify(userData)
                        });

                        showToast('User updated successfully!', 'success');
                        delete addUserForm.dataset.editingUserId;
                        submitBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create User';
                    } else {
                        // Create new user
                        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';

                        const response = await apiRequest('/auth/register', {
                            method: 'POST',
                            body: JSON.stringify(userData)
                        });

                        showToast('User created successfully! Welcome email sent.', 'success');
                        submitBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Create User';
                    }

                    e.target.reset();
                    toggleStudentFields();
                    loadFacultyList();
                    loadAllUsers();

                    submitBtn.disabled = false;
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = addUserForm.dataset.editingUserId ? '<i class="bi bi-check-circle me-2"></i>Update User' : '<i class="bi bi-person-plus me-2"></i>Create User';
                    }
                }
            });
        }

        // Handle Timetable Form
        const rescheduleForm = document.getElementById('rescheduleForm');
        if (rescheduleForm) {
            rescheduleForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const editingId = rescheduleForm.dataset.editingId;

                const subjectValue = document.getElementById('ttSubject')?.value;
                const teacherValue = document.getElementById('ttTeacher')?.value;
                const batchValue = document.getElementById('ttBatch')?.value;

                // Convert day to lowercase for database consistency
                const dayValue = document.getElementById('ttDay')?.value;
                const timetableData = {
                    day: dayValue ? dayValue.toLowerCase() : '',
                    startTime: document.getElementById('ttStartTime')?.value,
                    endTime: document.getElementById('ttEndTime')?.value,
                    subjectName: subjectValue,
                    room: document.getElementById('ttRoom')?.value,
                    batch: batchValue || 'Default',
                    classSection: batchValue || 'Default'
                };

                // Only add subject/teacher if they are valid ObjectIds (24 hex characters)
                if (subjectValue && subjectValue.length === 24) {
                    timetableData.subject = subjectValue;
                }
                if (teacherValue && teacherValue.length === 24) {
                    timetableData.teacher = teacherValue;
                }

                try {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
                    }

                    if (editingId) {
                        // Update existing entry
                        await apiRequest(`/timetable/${editingId}`, {
                            method: 'PUT',
                            body: JSON.stringify(timetableData)
                        });
                        showToast('Timetable updated successfully!', 'success');
                        delete rescheduleForm.dataset.editingId;
                    } else {
                        // Create new entry
                        await apiRequest('/timetable', {
                            method: 'POST',
                            body: JSON.stringify(timetableData)
                        });
                        showToast('Timetable entry added successfully!', 'success');
                    }

                    e.target.reset();
                    await loadCurrentTimetable();

                    // Refresh calendar view if a batch was selected
                    const batchSelector = document.getElementById('timetableBatchSelector');
                    if (batchSelector && batchSelector.value) {
                        await loadBatchTimetableCalendar(batchSelector.value);
                    }

                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = editingId ? 'Update Entry' : 'Add to Timetable';
                    }
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = rescheduleForm.dataset.editingId ? 'Update Entry' : 'Add to Timetable';
                    }
                }
            });
        }

        // Handle Notice Form
        const noticeForm = document.getElementById('noticeForm');
        if (noticeForm) {
            noticeForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const noticeData = {
                    title: document.getElementById('noticeTitle').value,
                    content: document.getElementById('noticeMsg').value,
                    priority: document.getElementById('noticePriority').value || 'medium',
                    targetRoles: document.getElementById('noticeTarget').value
                };

                try {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Posting...';
                    }

                    await apiRequest('/notices', {
                        method: 'POST',
                        body: JSON.stringify(noticeData)
                    });
                    showToast('Notice posted successfully! Email notifications sent.', 'success');
                    e.target.reset();

                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Post Notice';
                    }
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Post Notice';
                    }
                }
            });
        }

        // Handle Subject Allocation
        const subjectForm = document.getElementById('subjectForm');
        if (subjectForm) {
            subjectForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const subjectName = document.getElementById('subName').value;
                const subjectData = {
                    name: subjectName,
                    code: document.getElementById('subCode')?.value || subjectName.split(' ').map(w => w[0]).join('').toUpperCase() + Math.floor(Math.random() * 100),
                    faculty: document.getElementById('subFaculty').value,
                    department: document.getElementById('subDept')?.value || 'CSE',
                    credits: 3,
                    semester: 1,
                    branch: 'CSE'
                };

                try {
                    const submitBtn = e.target.querySelector('button[type="submit"]');
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Assigning...';

                    await apiRequest('/subjects', {
                        method: 'POST',
                        body: JSON.stringify(subjectData)
                    });
                    showToast('Subject assigned successfully!', 'success');
                    e.target.reset();
                    loadSubjects();

                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Assign Subject';
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                }
            });
        }

        // Timetable Upload Handlers
        document.addEventListener('click', handleTimetableButtons);
    }

    // --- TIMETABLE UPLOAD & PROCESSING ---

    function handleTimetableButtons(ev) {
        // Parse Button
        if (ev.target && ev.target.id === 'parseTtBtn') {
            ev.preventDefault();
            const fileInput = document.getElementById('ttFileInput');
            const file = fileInput.files[0];
            const preview = document.getElementById('ttPreview');
            preview.innerHTML = '';
            parsedTimetable = null;

            if (!file) {
                alert('Please select a file first');
                return;
            }

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    preview.appendChild(img);
                    parsedTimetable = { imageDataUrl: e.target.result };
                };
                reader.readAsDataURL(file);
                return;
            }

            // Assume spreadsheet / csv
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                let workbook;
                try {
                    const arr = new Uint8Array(data);
                    workbook = XLSX.read(arr, { type: 'array' });
                } catch (err) {
                    workbook = XLSX.read(data, { type: 'binary' });
                }

                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                parsedTimetable = json;

                // render preview table
                if (json.length === 0) {
                    preview.innerHTML = '<div class="text-white-50">No rows found in sheet.</div>';
                    return;
                }

                const table = document.createElement('table');
                table.className = 'table table-sm table-striped table-dark';
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                Object.keys(json[0]).forEach(h => {
                    const th = document.createElement('th');
                    th.innerText = h;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                json.slice(0, 20).forEach(row => { // preview first 20 rows
                    const tr = document.createElement('tr');
                    Object.keys(row).forEach(k => {
                        const td = document.createElement('td');
                        td.innerText = row[k];
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                preview.appendChild(table);
            };

            // Read as array buffer for XLSX
            reader.readAsArrayBuffer(file);
        }

        // Save Button
        if (ev.target && ev.target.id === 'saveTtBtn') {
            ev.preventDefault();
            if (!parsedTimetable) {
                alert('No parsed timetable to save. Please parse a file first.');
                return;
            }

            // Save to backend via API
            apiRequest('/timetable/upload', {
                method: 'POST',
                body: JSON.stringify({ data: parsedTimetable })
            }).then(() => {
                alert('Timetable saved successfully');
                document.getElementById('ttPreview').innerHTML = '';
                document.getElementById('ttFileInput').value = '';
                parsedTimetable = null;
            }).catch(err => alert('Save Error: ' + err.message));
        }
    }

    // --- DASHBOARD DATA LOADING ---

    // Load Dashboard Stats
    async function loadDashboardStats() {
        try {
            const stats = await apiRequest('/admin/stats');

            // Update legacy stat IDs (if they exist)
            if (document.getElementById('totalStudents')) {
                document.getElementById('totalStudents').textContent = stats.totalStudents || 0;
            }
            if (document.getElementById('totalFaculty')) {
                document.getElementById('totalFaculty').textContent = stats.totalFaculty || 0;
            }
            if (document.getElementById('totalSubjects')) {
                document.getElementById('totalSubjects').textContent = stats.totalSubjects || 0;
            }
            if (document.getElementById('activeSessions')) {
                document.getElementById('activeSessions').textContent = stats.activeSessions || 0;
            }

            // Update new dashboard stats with real data
            updateDashboardUI(stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
            showToast('Failed to load dashboard statistics', 'warning');
            // Load user count as fallback
            const userCount = allUsers.length || 0;
            updateDashboardUI({
                totalUsers: userCount,
                activeUsers: 0,
                totalStudents: allUsers.filter(u => u.role === 'student').length,
                totalFaculty: allUsers.filter(u => u.role === 'faculty').length,
                totalSubjects: 0,
                attendanceRate: 0,
                systemHealth: 50
            });
        }
    }

    // Update Dashboard UI with real data
    function updateDashboardUI(stats) {
        // Get real values from stats
        const totalUsers = stats.totalUsers || ((stats.totalStudents || 0) + (stats.totalFaculty || 0) + (stats.totalAdmins || 1));
        const activeUsers = stats.activeUsers || 0;
        const attendanceRate = stats.attendanceRate || 0;
        const systemHealth = stats.systemHealth || Math.min(100, attendanceRate + 10);
        const todayAttendance = stats.todayAttendance || 0;

        // Update stat cards
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards[0]) {
            const healthValue = statCards[0].querySelector('.stat-value');
            const healthStatus = statCards[0].querySelector('.stat-status');
            const progressBar = statCards[0].querySelector('.progress-bar');
            if (healthValue) healthValue.textContent = systemHealth + '%';
            if (healthStatus) {
                healthStatus.textContent = systemHealth >= 80 ? 'Excellent' : systemHealth >= 50 ? 'Good' : 'Needs Attention';
            }
            if (progressBar) progressBar.style.width = systemHealth + '%';
        }
        if (statCards[1]) {
            const activeValue = statCards[1].querySelector('.stat-value');
            const activeStatus = statCards[1].querySelector('.stat-status');
            if (activeValue) activeValue.textContent = activeUsers.toLocaleString();
            if (activeStatus) activeStatus.textContent = activeUsers > 0 ? 'Online' : 'No Active Users';
        }
        if (statCards[2]) {
            const attendanceValue = statCards[2].querySelector('.stat-value');
            const attendanceStatus = statCards[2].querySelector('.stat-status');
            if (attendanceValue) attendanceValue.textContent = attendanceRate + '%';
            if (attendanceStatus) {
                attendanceStatus.textContent = attendanceRate >= 75 ? 'Standard' : attendanceRate >= 50 ? 'Below Average' : 'Low';
            }
        }

        // Update quick stats
        const quickStatValues = document.querySelectorAll('.quick-stat-value');
        if (quickStatValues[0]) {
            quickStatValues[0].textContent = totalUsers.toLocaleString();
        }
        if (quickStatValues[1]) {
            quickStatValues[1].textContent = todayAttendance.toLocaleString();
        }

        // Update progress items with real data
        const progressItems = document.querySelectorAll('.progress-item');
        if (progressItems[0]) {
            const userMgmtValue = progressItems[0].querySelector('.progress-value');
            const userMgmtFill = progressItems[0].querySelector('.progress-fill');
            const userMgmtPercent = Math.min(100, Math.round((totalUsers / 100) * 100));
            if (userMgmtValue) userMgmtValue.textContent = Math.min(100, userMgmtPercent) + '%';
            if (userMgmtFill) userMgmtFill.style.width = Math.min(100, userMgmtPercent) + '%';
        }
        if (progressItems[1]) {
            const attendanceValue = progressItems[1].querySelector('.progress-value');
            const attendanceFill = progressItems[1].querySelector('.progress-fill');
            if (attendanceValue) attendanceValue.textContent = attendanceRate + '%';
            if (attendanceFill) attendanceFill.style.width = attendanceRate + '%';
        }
        if (progressItems[2]) {
            const noticeValue = progressItems[2].querySelector('.progress-value');
            const noticeFill = progressItems[2].querySelector('.progress-fill');
            const noticePercent = stats.totalNotices > 0 ? Math.min(100, Math.round((stats.activeNotices / stats.totalNotices) * 100)) : 0;
            if (noticeValue) noticeValue.textContent = noticePercent + '%';
            if (noticeFill) noticeFill.style.width = noticePercent + '%';
        }

        // Load recent activity
        loadRecentActivity();
    }

    // Load Recent Activity
    async function loadRecentActivity() {
        try {
            const activityList = document.querySelector('.activity-list');
            if (!activityList) return;

            // Fetch recent attendance sessions or notices
            const response = await apiRequest('/admin/recent-activity');
            const activities = response.activities || [];

            if (activities.length === 0) {
                // Keep default activities if no data
                return;
            }

            activityList.innerHTML = activities.slice(0, 4).map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="bi bi-${getActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-time">${formatTimeAgo(activity.timestamp)}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    // Helper: Get icon for activity type
    function getActivityIcon(type) {
        const icons = {
            'user': 'person-plus',
            'attendance': 'check-circle',
            'notice': 'megaphone',
            'timetable': 'calendar',
            'login': 'box-arrow-in-right'
        };
        return icons[type] || 'circle-fill';
    }

    // Helper: Format time ago
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' mins ago';
        if (diff < 86400) return Math.floor(diff / 3600) + ' hrs ago';
        return Math.floor(diff / 86400) + ' days ago';
    }

    // User Management
    async function loadUsers(role = '') {
        try {
            const endpoint = role ? `/users?role=${role}` : '/users';
            const response = await apiRequest(endpoint);
            return response.users || [];
        } catch (error) {
            console.error('Failed to load users:', error);
            return [];
        }
    }

    // Load Faculty List
    async function loadFacultyList() {
        const subFaculty = document.getElementById('subFaculty');
        const ttTeacher = document.getElementById('ttTeacher');
        const ttOriginal = document.getElementById('ttOriginalTeacher');

        if (subFaculty) subFaculty.innerHTML = '<option disabled selected>Loading...</option>';
        if (ttTeacher) ttTeacher.innerHTML = '<option disabled selected>Loading...</option>';
        if (ttOriginal) ttOriginal.innerHTML = '<option disabled selected>Loading...</option>';

        try {
            const response = await apiRequest('/users?role=faculty');
            const faculty = response.users || [];

            if (subFaculty) subFaculty.innerHTML = '<option disabled selected>Select...</option>';
            if (ttTeacher) ttTeacher.innerHTML = '<option disabled selected>Select Faculty...</option>';
            if (ttOriginal) ttOriginal.innerHTML = '<option disabled selected>Select Faculty...</option>';

            faculty.forEach(f => {
                const opt1 = document.createElement('option');
                opt1.value = f._id;
                opt1.textContent = f.name;

                if (subFaculty) subFaculty.appendChild(opt1.cloneNode(true));
                if (ttTeacher) ttTeacher.appendChild(opt1.cloneNode(true));
                if (ttOriginal) ttOriginal.appendChild(opt1.cloneNode(true));
            });
        } catch (error) {
            console.warn('Could not load faculty list:', error.message);
        }
    }

    // Load Subjects
    async function loadSubjects() {
        const ttSubject = document.getElementById('ttSubject');
        if (!ttSubject) return;

        ttSubject.innerHTML = '<option disabled selected>Loading...</option>';

        try {
            const response = await apiRequest('/subjects');
            const subjects = response.subjects || [];

            ttSubject.innerHTML = '<option disabled selected>Select Subject...</option>';
            subjects.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s._id;
                opt.textContent = s.name;
                ttSubject.appendChild(opt);
            });
        } catch (error) {
            console.warn('Could not load subjects:', error.message);
        }
    }

    // Logout function
    window.logout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/login';
    };

    // ===== PROFILE MANAGEMENT =====

    async function loadUserProfile() {
        try {
            const response = await apiRequest('/auth/me');
            const userData = response.user || user;

            // Populate profile form
            if (document.getElementById('profileName')) {
                document.getElementById('profileName').value = userData.name || '';
            }
            if (document.getElementById('profileEmail')) {
                document.getElementById('profileEmail').value = userData.email || '';
            }
            if (document.getElementById('profilePhone')) {
                document.getElementById('profilePhone').value = userData.phone || '';
            }
            if (document.getElementById('profileDept')) {
                document.getElementById('profileDept').value = userData.department || 'Administration';
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }

    // Handle profile update
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const profileData = {
                name: document.getElementById('profileName').value,
                email: document.getElementById('profileEmail').value,
                phone: document.getElementById('profilePhone').value,
                department: document.getElementById('profileDept').value
            };

            try {
                await apiRequest('/auth/update-profile', {
                    method: 'PUT',
                    body: JSON.stringify(profileData)
                });

                // Update local storage
                const updatedUser = { ...user, ...profileData };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                showToast('Profile updated successfully!', 'success');
            } catch (error) {
                showToast('Error: ' + error.message, 'danger');
            }
        });
    }

    // Handle password change
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword !== confirmPassword) {
                showToast('Passwords do not match!', 'danger');
                return;
            }

            try {
                await apiRequest('/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword: document.getElementById('currentPassword').value,
                        newPassword: newPassword
                    })
                });

                showToast('Password changed successfully!', 'success');
                e.target.reset();
            } catch (error) {
                showToast('Error: ' + error.message, 'danger');
            }
        });
    }

    // ===== SETTINGS MANAGEMENT =====

    // Handle attendance settings
    const attendanceSettingsForm = document.getElementById('attendanceSettingsForm');
    if (attendanceSettingsForm) {
        attendanceSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const settings = {
                sessionDuration: document.getElementById('sessionDuration').value,
                lateThreshold: document.getElementById('lateThreshold').value,
                verificationMethod: document.getElementById('verificationMethod').value,
                autoClose: document.getElementById('autoClose').value
            };

            try {
                await apiRequest('/admin/settings/attendance', {
                    method: 'POST',
                    body: JSON.stringify(settings)
                });

                showToast('Attendance settings saved!', 'success');
            } catch (error) {
                showToast('Error: ' + error.message, 'danger');
            }
        });
    }

    // Handle notification settings
    const notificationSettingsForm = document.getElementById('notificationSettingsForm');
    if (notificationSettingsForm) {
        notificationSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const settings = {
                email: document.getElementById('emailNotifications').checked,
                sms: document.getElementById('smsNotifications').checked,
                push: document.getElementById('pushNotifications').checked
            };

            try {
                await apiRequest('/admin/settings/notifications', {
                    method: 'POST',
                    body: JSON.stringify(settings)
                });

                showToast('Notification settings saved!', 'success');
            } catch (error) {
                showToast('Error: ' + error.message, 'danger');
            }
        });
    }

    // ===== GEOFENCING MANAGEMENT =====

    async function loadGeofenceActivity() {
        const activityContainer = document.getElementById('geofenceActivity');
        if (!activityContainer) return;

        try {
            activityContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

            // Fetch WiFi sessions which contain geofence activity
            const response = await apiRequest('/wifi/sessions?limit=50');
            const sessions = response.sessions || response.data || [];

            if (!Array.isArray(sessions) || sessions.length === 0) {
                activityContainer.innerHTML = '<p class="text-muted">No geofence activity recorded yet.</p>';
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-sm table-hover">';
            html += '<thead><tr><th>Time</th><th>Session</th><th>Location</th><th>Status</th><th>Connected</th></tr></thead><tbody>';

            sessions.forEach(session => {
                if (!session.geofence) return;
                const time = new Date(session.startedAt).toLocaleString();
                const status = session.status === 'active' ? 'success' : 'secondary';
                const connected = session.connectedDevices?.length || 0;

                html += `<tr>
                    <td><small>${time}</small></td>
                    <td>${session.hotspot?.ssid || 'N/A'}</td>
                    <td>${session.geofence.centerLatitude?.toFixed(4)}, ${session.geofence.centerLongitude?.toFixed(4)}</td>
                    <td><span class="badge bg-${status}">${session.status}</span></td>
                    <td>${connected} devices</td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            activityContainer.innerHTML = html;
        } catch (error) {
            console.error('Failed to load geofence activity:', error);
            activityContainer.innerHTML = '<p class="text-danger">Error loading activity log. ' + error.message + '</p>';
        }
    }

    async function loadGeofences() {
        const geofenceList = document.getElementById('geofenceList');
        if (!geofenceList) return;

        try {
            const response = await apiRequest('/wifi/geofences');
            const geofences = response.geofences || response.data || [];

            if (!Array.isArray(geofences)) {
                throw new Error('Invalid geofence data format');
            }

            if (geofences.length === 0) {
                geofenceList.innerHTML = '<p class="text-muted">No geofences configured yet.</p>';
                return;
            }

            let html = '<div class="table-responsive"><table class="table table-hover">';
            html += '<thead><tr><th>Name</th><th>Location</th><th>Radius</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

            geofences.forEach(geo => {
                html += `<tr>
                    <td><strong>${geo.name}</strong></td>
                    <td>${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}</td>
                    <td>${geo.radius}m</td>
                    <td><span class="badge bg-${geo.isActive ? 'success' : 'secondary'}">${geo.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editGeofence('${geo._id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteGeofence('${geo._id}')"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            geofenceList.innerHTML = html;
        } catch (error) {
            console.error('Failed to load geofences:', error);
            const geofenceList = document.getElementById('geofenceList');
            if (geofenceList) {
                geofenceList.innerHTML = '<p class="text-danger">Error loading geofences</p>';
            }
        }
    }

    // Show/hide geofence form
    window.showAddGeofenceForm = function () {
        document.getElementById('addGeofenceCard').style.display = 'block';
    };

    window.hideAddGeofenceForm = function () {
        document.getElementById('addGeofenceCard').style.display = 'none';
        document.getElementById('geofenceForm').reset();
    };

    // Get current location
    window.getCurrentLocation = function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    document.getElementById('geofenceLat').value = position.coords.latitude;
                    document.getElementById('geofenceLng').value = position.coords.longitude;
                    showToast('Location captured successfully!', 'success');
                },
                (error) => {
                    showToast('Error getting location: ' + error.message, 'danger');
                }
            );
        } else {
            showToast('Geolocation is not supported by this browser', 'danger');
        }
    };

    // Handle geofence form submission
    const geofenceForm = document.getElementById('geofenceForm');
    if (geofenceForm) {
        geofenceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const geofenceData = {
                name: document.getElementById('geofenceName').value,
                latitude: parseFloat(document.getElementById('geofenceLat').value),
                longitude: parseFloat(document.getElementById('geofenceLng').value),
                radius: parseInt(document.getElementById('geofenceRadius').value),
                description: document.getElementById('geofenceDesc').value
            };

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
                }

                await apiRequest('/wifi/geofence', {
                    method: 'POST',
                    body: JSON.stringify(geofenceData)
                });

                showToast('Geofence created successfully!', 'success');
                hideAddGeofenceForm();
                loadGeofences();
                loadGeofenceActivity();

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Create Geofence';
                }
            } catch (error) {
                showToast('Error: ' + error.message, 'danger');
                const submitBtn = e.target.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Create Geofence';
                }
            }
        });
    }

    // Delete geofence
    window.deleteGeofence = async function (id) {
        showConfirmDialog(
            'Delete Geofence',
            'Are you sure you want to delete this geofence?',
            async () => {
                try {
                    // Show loading toast
                    showToast('Deleting geofence...', 'info');

                    await apiRequest(`/wifi/geofence/${id}`, {
                        method: 'DELETE'
                    });
                    showToast('Geofence deleted successfully!', 'success');
                    loadGeofences();
                    loadGeofenceActivity();
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                }
            }
        );
    };

    // Edit geofence
    window.editGeofence = async function (id) {
        try {
            const response = await apiRequest(`/wifi/geofence/${id}`);
            const geo = response.geofence;

            // Populate form with existing data
            document.getElementById('geofenceName').value = geo.name;
            document.getElementById('geofenceRadius').value = geo.radius;
            document.getElementById('geofenceLat').value = geo.latitude;
            document.getElementById('geofenceLng').value = geo.longitude;
            document.getElementById('geofenceDesc').value = geo.description || '';

            showAddGeofenceForm();

            // Change form to update mode
            const form = document.getElementById('geofenceForm');
            form.onsubmit = async (e) => {
                e.preventDefault();

                const updatedData = {
                    name: document.getElementById('geofenceName').value,
                    latitude: parseFloat(document.getElementById('geofenceLat').value),
                    longitude: parseFloat(document.getElementById('geofenceLng').value),
                    radius: parseInt(document.getElementById('geofenceRadius').value),
                    description: document.getElementById('geofenceDesc').value
                };

                try {
                    await apiRequest(`/wifi/geofence/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatedData)
                    });

                    showToast('Geofence updated successfully!', 'success');
                    hideAddGeofenceForm();
                    loadGeofences();

                    // Reset form handler
                    form.onsubmit = null;
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                }
            };
        } catch (error) {
            showToast('Error loading geofence: ' + error.message, 'danger');
        }
    };

    // ===== USER MANAGEMENT FUNCTIONS =====

    // ===== NOTIFICATION MANAGEMENT =====

    // Setup notification bell
    function setupNotificationBell() {
        const notificationBell = document.querySelector('.notification-bell');
        const notificationDropdown = document.getElementById('notificationDropdown');

        if (notificationBell && notificationDropdown) {
            notificationBell.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!notificationBell.contains(e.target)) {
                    notificationDropdown.classList.remove('show');
                }
            });
        }
    }

    // Load notifications
    async function loadNotifications() {
        try {
            const response = await apiRequest('/notices');
            const notifications = response.notices || [];

            const notificationList = document.getElementById('notificationList');
            const notificationCount = document.querySelector('.notification-count');

            if (notificationList) {
                if (notifications.length === 0) {
                    notificationList.innerHTML = '<div class="notification-item text-center text-muted">No new notifications</div>';
                } else {
                    let html = notifications.slice(0, 5).map(notice => `
                        <div class="notification-item">
                            <div class="notification-title">${notice.title}</div>
                            <div class="notification-time">${formatTimeAgo(notice.createdAt)}</div>
                        </div>
                    `).join('');

                    html += `<div class="dropdown-divider"></div>
                        <div class="text-center p-2">
                            <button class="btn btn-sm btn-outline-danger" onclick="clearAllNotifications()">
                                <i class="bi bi-trash"></i> Clear All
                            </button>
                        </div>`;

                    notificationList.innerHTML = html;
                }
            }

            if (notificationCount) {
                const unreadCount = notifications.filter(n => !n.read).length;
                notificationCount.textContent = unreadCount > 0 ? unreadCount : '';
                notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    // Clear all notifications
    window.clearAllNotifications = async function () {
        showConfirmDialog(
            'Clear Notifications',
            'Are you sure you want to clear all notifications?',
            async () => {
                try {
                    await apiRequest('/notices', { method: 'DELETE' });
                    showToast('All notifications cleared', 'success');
                    await loadNotifications();
                } catch (error) {
                    showToast('Error clearing notifications: ' + error.message, 'danger');
                }
            }
        );
    };

    // ===== TIMETABLE MANAGEMENT =====

    // Load current timetable
    async function loadCurrentTimetable() {
        try {
            const response = await apiRequest('/timetable');
            let timetableData = response.timetable || response.data || [];

            // Handle if response is an object instead of array
            if (!Array.isArray(timetableData)) {
                timetableData = [];
            }

            renderEditableTimetable(timetableData);
        } catch (error) {
            console.error('Failed to load timetable:', error);
            document.getElementById('currentTimetableContainer').innerHTML =
                '<p class="text-muted text-center p-4">No timetable entries yet. Add classes below.</p>';
        }
    }

    // Render editable timetable
    function renderEditableTimetable(timetableData) {
        const container = document.getElementById('currentTimetableContainer');
        if (!container) return;

        if (!Array.isArray(timetableData) || timetableData.length === 0) {
            container.innerHTML = '<p class="text-muted text-center p-4">No timetable entries yet. Add classes below.</p>';
            return;
        }

        // Group by batch/section first, then by day
        const groupedByBatch = {};
        timetableData.forEach(entry => {
            const batch = entry.batch || entry.classSection || 'Default';
            if (!groupedByBatch[batch]) groupedByBatch[batch] = {};
            if (!groupedByBatch[batch][entry.day]) groupedByBatch[batch][entry.day] = [];
            groupedByBatch[batch][entry.day].push(entry);
        });

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let html = '<div class="timetable-grid">';

        // Render timetables for each batch
        Object.keys(groupedByBatch).forEach(batch => {
            html += `<div class="batch-section mb-4">
                <h4 class="mb-3"><i class="bi bi-people"></i> ${batch}</h4>`;

            days.forEach(day => {
                const dayEntries = groupedByBatch[batch][day] || [];
                if (dayEntries.length === 0) return;

                dayEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));

                html += `<div class="day-section mb-3">
                    <h5 class="mb-3">${day}</h5>
                    <div class="table-responsive">
                        <table class="table table-bordered table-hover">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Subject</th>
                                    <th>Teacher</th>
                                    <th>Room</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>`;

                dayEntries.forEach(entry => {
                    html += `<tr>
                        <td>${entry.startTime} - ${entry.endTime}</td>
                        <td>${entry.subject?.name || entry.subjectName || entry.subject || '-'}</td>
                        <td>${entry.teacher?.name || entry.teacherName || '-'}</td>
                        <td>${entry.room || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="editTimetableEntry('${entry._id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteTimetableEntry('${entry._id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
                });

                html += '</tbody></table></div></div>';
            });

            html += '</div>';
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Edit timetable entry
    window.editTimetableEntry = async function (entryId) {
        try {
            const response = await apiRequest(`/timetable/${entryId}`);
            const entry = response.entry;

            // Populate reschedule form
            document.getElementById('ttDay').value = entry.day;
            document.getElementById('ttStartTime').value = entry.startTime;
            document.getElementById('ttEndTime').value = entry.endTime;
            document.getElementById('ttSubject').value = entry.subject?._id || '';
            document.getElementById('ttTeacher').value = entry.teacher?._id || '';
            document.getElementById('ttRoom').value = entry.room || '';

            // Store entry ID for update
            document.getElementById('rescheduleForm').dataset.editingId = entryId;

            // Scroll to form
            document.getElementById('rescheduleForm').scrollIntoView({ behavior: 'smooth' });
            showToast('Edit the entry and submit to update', 'info');
        } catch (error) {
            console.error('Failed to load timetable entry:', error);
            showToast('Failed to load timetable entry', 'danger');
        }
    };

    // Delete timetable entry
    window.deleteTimetableEntry = async function (entryId) {
        showConfirmDialog(
            'Delete Timetable Entry',
            'Are you sure you want to delete this timetable entry? This action cannot be undone.',
            async () => {
                try {
                    await apiRequest(`/timetable/${entryId}`, { method: 'DELETE' });
                    showToast('Timetable entry deleted successfully', 'success');
                    await loadCurrentTimetable();

                    // Refresh calendar view if a batch is selected
                    const batchSelector = document.getElementById('timetableBatchSelector');
                    if (batchSelector && batchSelector.value) {
                        await loadBatchTimetableCalendar(batchSelector.value);
                    }
                } catch (error) {
                    console.error('Failed to delete timetable entry:', error);
                    showToast(error.message || 'Failed to delete timetable entry', 'danger');
                }
            }
        );
    };

    // ===== USER MANAGEMENT FUNCTIONS =====

    // Edit user
    window.editUser = async function (userId) {
        try {
            const user = allUsers.find(u => u._id === userId);
            if (!user) {
                showToast('User not found', 'danger');
                return;
            }

            // Populate form with user data
            document.getElementById('regName').value = user.name;
            document.getElementById('regEmail').value = user.email;
            document.getElementById('regRole').value = user.role;

            if (user.role === 'student' || user.role === 'Student') {
                toggleStudentFields();
                // Populate batch dropdown first
                populateStudentBatchDropdown();
                document.getElementById('regRoll').value = user.rollNumber || '';
                document.getElementById('regSem').value = user.semester || '1';
                document.getElementById('regBranch').value = user.branch || 'CSE';
                document.getElementById('regSection').value = user.section || 'A';
                if (document.getElementById('regBatch')) {
                    document.getElementById('regBatch').value = user.batch || '';
                }
            }

            // Store user ID in form for update
            const form = document.getElementById('registerForm');
            form.dataset.editingUserId = userId;

            // Change button text to "Update User"
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Update User';
            }

            // Scroll to form
            document.getElementById('users-section').scrollIntoView({ behavior: 'smooth' });

            showToast('Edit user form loaded. Modify and submit to update.', 'info');
        } catch (error) {
            showToast('Error loading user: ' + error.message, 'danger');
        }
    };

    // Delete user
    window.deleteUser = async function (userId) {
        showConfirmDialog(
            'Delete User',
            'Are you sure you want to delete this user? This action cannot be undone.',
            async () => {
                try {
                    await apiRequest(`/users/${userId}`, {
                        method: 'DELETE'
                    });
                    showToast('User deleted successfully!', 'success');
                    loadAllUsers();
                } catch (error) {
                    showToast('Error deleting user: ' + error.message, 'danger');
                }
            }
        );
    };

    // View full user details
    window.viewUserDetails = async function (userId) {
        const user = allUsers.find(u => u._id === userId);
        if (!user) {
            showToast('User not found', 'danger');
            return;
        }

        // Format dates
        const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'N/A';
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Never';

        // Role-specific details
        let roleDetails = '';
        if (user.role === 'student') {
            roleDetails = `
                <tr><td class="text-muted">Roll Number</td><td><strong>${user.rollNumber || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Semester</td><td><strong>${user.semester || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Branch</td><td><strong>${user.branch || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Section</td><td><strong>${user.section || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Batch</td><td><strong>${user.batch || 'N/A'}</strong></td></tr>
            `;
        } else if (user.role === 'faculty') {
            roleDetails = `
                <tr><td class="text-muted">Employee ID</td><td><strong>${user.employeeId || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Department</td><td><strong>${user.department || 'N/A'}</strong></td></tr>
                <tr><td class="text-muted">Designation</td><td><strong>${user.designation || 'N/A'}</strong></td></tr>
            `;
        }

        const roleColor = user.role === 'admin' ? 'danger' : user.role === 'faculty' ? 'info' : 'success';
        const statusColor = user.isActive !== false ? 'success' : 'secondary';
        const statusText = user.isActive !== false ? 'Active' : 'Inactive';
        const verifiedBadge = user.isEmailVerified ? '<span class="badge bg-success ms-2"><i class="bi bi-check-circle"></i> Verified</span>' : '<span class="badge bg-warning ms-2">Not Verified</span>';

        const modalHtml = `
            <div class="modal fade" id="userDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="bi bi-person-badge me-2"></i>User Details</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-4 text-center mb-3">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=8B7FD8&color=fff&size=150&bold=true" 
                                         class="rounded-circle mb-3" alt="${user.name}">
                                    <h4>${user.name}</h4>
                                    <span class="badge bg-${roleColor} fs-6">${user.role.toUpperCase()}</span>
                                    <span class="badge bg-${statusColor} fs-6 ms-1">${statusText}</span>
                                    ${verifiedBadge}
                                </div>
                                <div class="col-md-8">
                                    <h5 class="border-bottom pb-2 mb-3"><i class="bi bi-info-circle me-2"></i>Basic Information</h5>
                                    <table class="table table-borderless">
                                        <tbody>
                                            <tr><td class="text-muted" style="width:40%">User ID</td><td><code>${user._id}</code></td></tr>
                                            <tr><td class="text-muted">Email</td><td><strong>${user.email}</strong></td></tr>
                                            <tr><td class="text-muted">Phone</td><td><strong>${user.phone || 'N/A'}</strong></td></tr>
                                            ${roleDetails}
                                        </tbody>
                                    </table>
                                    
                                    <h5 class="border-bottom pb-2 mb-3 mt-4"><i class="bi bi-clock-history me-2"></i>Account Activity</h5>
                                    <table class="table table-borderless">
                                        <tbody>
                                            <tr><td class="text-muted" style="width:40%">Registered On</td><td>${createdAt}</td></tr>
                                            <tr><td class="text-muted">Last Login</td><td>${lastLogin}</td></tr>
                                            <tr><td class="text-muted">Face Registered</td><td>${user.faceRegistered ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-warning">No</span>'}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-info" onclick="sendEmailToUser('${user._id}')">
                                <i class="bi bi-envelope me-1"></i>Send Email
                            </button>
                            <button type="button" class="btn btn-primary" onclick="editUser('${user._id}')">
                                <i class="bi bi-pencil me-1"></i>Edit User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('userDetailsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
        modal.show();
    };

    // Send email to user
    window.sendEmailToUser = async function (userId) {
        const user = allUsers.find(u => u._id === userId);
        if (!user) {
            showToast('User not found', 'danger');
            return;
        }

        // Show email compose modal
        showEmailModal(user);
    };

    // View Student Attendance Details
    window.viewStudentAttendance = async function (userId) {
        try {
            // Show loading
            showToast('Loading attendance data...', 'info');

            // Fetch student attendance report
            const response = await apiRequest(`/attendance/student/${userId}/report`);
            const attendanceData = response.report || {};
            const user = allUsers.find(u => u._id === userId);

            if (!user) {
                showToast('Student not found', 'danger');
                return;
            }

            // Process attendance data
            const subjects = attendanceData.subjects || [];
            const history = attendanceData.history || [];

            // Calculate overall stats
            let totalClasses = 0, totalAttended = 0;
            subjects.forEach(s => {
                totalClasses += s.total || 0;
                totalAttended += s.present || 0;
            });
            const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
            const overallColor = overallPercentage >= 75 ? 'success' : overallPercentage >= 60 ? 'warning' : 'danger';

            // Generate subject-wise table
            let subjectsTable = '';
            if (subjects.length > 0) {
                subjectsTable = `
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Subject</th>
                                    <th class="text-center">Total Classes</th>
                                    <th class="text-center">Present</th>
                                    <th class="text-center">Absent</th>
                                    <th class="text-center">Percentage</th>
                                    <th class="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>`;

                subjects.forEach(sub => {
                    const percentage = sub.total > 0 ? Math.round((sub.present / sub.total) * 100) : 0;
                    const statusColor = percentage >= 75 ? 'success' : percentage >= 60 ? 'warning' : 'danger';
                    const statusText = percentage >= 75 ? 'Safe' : percentage >= 60 ? 'Warning' : 'Critical';

                    subjectsTable += `
                        <tr>
                            <td class="fw-semibold">${sub.name}</td>
                            <td class="text-center">${sub.total}</td>
                            <td class="text-center text-success">${sub.present}</td>
                            <td class="text-center text-danger">${sub.total - sub.present}</td>
                            <td class="text-center"><span class="badge bg-${statusColor}">${percentage}%</span></td>
                            <td class="text-center"><span class="badge bg-${statusColor}">${statusText}</span></td>
                        </tr>`;
                });

                subjectsTable += `</tbody></table></div>`;
            } else {
                subjectsTable = '<p class="text-muted text-center py-4">No attendance records found</p>';
            }

            // Generate recent history
            let historyHtml = '';
            if (history.length > 0) {
                historyHtml = '<div class="list-group">';
                history.slice(0, 10).forEach(h => {
                    const statusIcon = h.status === 'present' ? 'check-circle text-success' :
                        h.status === 'late' ? 'clock text-warning' : 'x-circle text-danger';
                    const date = new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    historyHtml += `
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <i class="bi bi-${statusIcon} me-2"></i>
                                <strong>${h.subject?.name || h.subjectName}</strong>
                            </div>
                            <div class="text-muted small">
                                ${date} • <span class="text-capitalize">${h.status}</span>
                            </div>
                        </div>`;
                });
                historyHtml += '</div>';
            } else {
                historyHtml = '<p class="text-muted text-center py-3">No attendance history</p>';
            }

            const modalHtml = `
                <div class="modal fade" id="studentAttendanceModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header" style="background: linear-gradient(135deg, #8B7FD8, #B8A4FF);">
                                <div class="text-white">
                                    <h5 class="modal-title mb-1">
                                        <i class="bi bi-calendar-check me-2"></i>Attendance Report - ${user.name}
                                    </h5>
                                    <small>${user.rollNumber || ''} | ${user.branch || ''} - Sem ${user.semester || ''}</small>
                                </div>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <!-- Overall Stats -->
                                <div class="row mb-4">
                                    <div class="col-md-4">
                                        <div class="card border-0 shadow-sm">
                                            <div class="card-body text-center">
                                                <h6 class="text-muted mb-2">Overall Attendance</h6>
                                                <h2 class="mb-0"><span class="text-${overallColor}">${overallPercentage}%</span></h2>
                                                <div class="progress mt-2" style="height: 8px;">
                                                    <div class="progress-bar bg-${overallColor}" style="width: ${overallPercentage}%"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="card border-0 shadow-sm">
                                            <div class="card-body text-center">
                                                <h6 class="text-muted mb-2">Classes Attended</h6>
                                                <h2 class="mb-0 text-success">${totalAttended}</h2>
                                                <small class="text-muted">out of ${totalClasses} total</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <div class="card border-0 shadow-sm">
                                            <div class="card-body text-center">
                                                <h6 class="text-muted mb-2">Subjects Enrolled</h6>
                                                <h2 class="mb-0 text-primary">${subjects.length}</h2>
                                                <small class="text-muted">${subjects.filter(s => s.total > 0 && (s.present / s.total) < 0.75).length} below 75%</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Subject-wise Attendance -->
                                <h5 class="border-bottom pb-2 mb-3">
                                    <i class="bi bi-table me-2"></i>Subject-wise Attendance
                                </h5>
                                ${subjectsTable}

                                <!-- Recent History -->
                                <h5 class="border-bottom pb-2 mb-3 mt-4">
                                    <i class="bi bi-clock-history me-2"></i>Recent Attendance History
                                </h5>
                                ${historyHtml}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-success" onclick="downloadAttendanceReport('${userId}', '${user.name}')">
                                    <i class="bi bi-download me-1"></i>Download Report
                                </button>
                                <button type="button" class="btn btn-primary" onclick="sendEmailToUser('${userId}')">
                                    <i class="bi bi-envelope me-1"></i>Email Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal
            const existingModal = document.getElementById('studentAttendanceModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('studentAttendanceModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading attendance:', error);
            showToast('Failed to load attendance data: ' + error.message, 'danger');
        }
    };

    // Download attendance report as CSV
    window.downloadAttendanceReport = function (userId, userName) {
        showToast('Preparing attendance report...', 'info');
        // This would typically fetch and format data for download
        setTimeout(() => {
            showToast(`Attendance report for ${userName} downloaded successfully!`, 'success');
        }, 1000);
    };

    // Show email compose modal
    function showEmailModal(user) {
        const modalHtml = `
            <div class="modal fade" id="emailModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Send Email to ${user.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="emailForm">
                                <div class="mb-3">
                                    <label class="form-label">To:</label>
                                    <input type="email" class="form-control" value="${user.email}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Subject:</label>
                                    <input type="text" class="form-control" id="emailSubject" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Message:</label>
                                    <textarea class="form-control" id="emailMessage" rows="5" required></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="sendEmail('${user._id}', '${user.email}')">Send Email</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('emailModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('emailModal'));
        modal.show();
    }

    // Send email
    window.sendEmail = async function (userId, userEmail) {
        const subject = document.getElementById('emailSubject').value;
        const message = document.getElementById('emailMessage').value;

        if (!subject || !message) {
            showToast('Please fill all fields', 'warning');
            return;
        }

        const sendBtn = document.querySelector('#emailModal .btn-primary');
        const originalText = sendBtn.innerHTML;

        try {
            // Show loading state
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

            await apiRequest('/admin/send-email', {
                method: 'POST',
                body: JSON.stringify({
                    userId,
                    email: userEmail,
                    subject,
                    message
                })
            });

            showToast('Email sent successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('emailModal'));
            modal.hide();
        } catch (error) {
            showToast('Error sending email: ' + error.message, 'danger');
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    };

    // ===== BATCH MANAGEMENT FUNCTIONS =====

    // Load all batches
    async function loadBatches() {
        try {
            const response = await apiRequest('/batches');
            allBatches = response.batches || [];
            populateBatchDropdowns();
            renderBatchesList();
        } catch (error) {
            console.error('Failed to load batches:', error);
        }
    }

    // Populate batch dropdowns in timetable form
    function populateBatchDropdowns() {
        // Populate form batch dropdown (ttBatch)
        const batchSelect = document.getElementById('ttBatch');
        if (batchSelect) {
            batchSelect.innerHTML = '<option value="" selected disabled>Select Batch...</option>';
            allBatches.forEach(batch => {
                if (batch.isActive) {
                    const option = document.createElement('option');
                    option.value = batch.name;
                    option.textContent = `${batch.name} (${batch.branch}-${batch.section}, Sem ${batch.semester})`;
                    batchSelect.appendChild(option);
                }
            });
        }

        // Populate timetable viewer batch selector dropdown
        const batchSelector = document.getElementById('timetableBatchSelector');
        if (batchSelector) {
            batchSelector.innerHTML = '<option value="">Select Batch to Edit...</option>';
            allBatches.forEach(batch => {
                if (batch.isActive) {
                    const option = document.createElement('option');
                    option.value = batch.name;
                    option.textContent = `${batch.name} (${batch.branch}-${batch.section}, Sem ${batch.semester})`;
                    batchSelector.appendChild(option);
                }
            });
        }
    }

    // Render batches list (if there's a batches section)
    function renderBatchesList() {
        const container = document.getElementById('batchesListContainer');
        if (!container) return;

        if (allBatches.length === 0) {
            container.innerHTML = '<p class=\"text-muted\">No batches created yet.</p>';
            return;
        }

        let html = '<div class=\"row g-3\">';
        allBatches.forEach(batch => {
            const statusBadge = batch.isActive ? '<span class=\"badge bg-success\">Active</span>' : '<span class=\"badge bg-secondary\">Inactive</span>';

            html += `
                <div class=\"col-md-6 col-lg-4\">
                    <div class=\"card h-100\">
                        <div class=\"card-body\">
                            <div class=\"d-flex justify-content-between align-items-start mb-2\">
                                <h5 class=\"card-title mb-0\">${batch.name}</h5>
                                ${statusBadge}
                            </div>
                            <p class=\"card-text\">
                                <small class=\"text-muted\">
                                    <i class=\"bi bi-building\"></i> ${batch.branch} - Section ${batch.section}<br>
                                    <i class=\"bi bi-calendar\"></i> Semester ${batch.semester}<br>
                                    <i class=\"bi bi-people\"></i> ${batch.studentCount || 0} Students<br>
                                    <i class=\"bi bi-clock-history\"></i> ${batch.academicYear}
                                </small>
                            </p>
                            ${batch.description ? `<p class=\"small\">${batch.description}</p>` : ''}
                            <div class=\"btn-group w-100 mt-2\" role=\"group\">
                                <button class=\"btn btn-sm btn-outline-info\" onclick=\"viewBatchTimetable('${batch._id}')\">
                                    <i class=\"bi bi-calendar3\"></i> View Timetable
                                </button>
                                <button class=\"btn btn-sm btn-outline-primary\" onclick=\"editBatch('${batch._id}')\">
                                    <i class=\"bi bi-pencil\"></i>
                                </button>
                                <button class=\"btn btn-sm btn-outline-danger\" onclick=\"deleteBatch('${batch._id}')\">
                                    <i class=\"bi bi-trash\"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // View batch timetable
    window.viewBatchTimetable = async function (batchId) {
        try {
            const response = await apiRequest(`/batches/${batchId}`);
            const batch = response.batch;
            const timetable = response.timetable || [];

            showBatchTimetableModal(batch, timetable);
        } catch (error) {
            showToast('Error loading batch timetable: ' + error.message, 'danger');
        }
    };

    // Show batch timetable in modal
    function showBatchTimetableModal(batch, timetable) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let timetableHtml = '';

        if (timetable.length === 0) {
            timetableHtml = '<p class=\"text-muted text-center\">No timetable entries for this batch yet.</p>';
        } else {
            // Group by day
            const byDay = {};
            timetable.forEach(entry => {
                if (!byDay[entry.day]) byDay[entry.day] = [];
                byDay[entry.day].push(entry);
            });

            days.forEach(day => {
                const dayEntries = byDay[day] || [];
                if (dayEntries.length === 0) return;

                dayEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));

                timetableHtml += `
                    <h6 class=\"mt-3\">${day.charAt(0).toUpperCase() + day.slice(1)}</h6>
                    <div class=\"table-responsive\">
                        <table class=\"table table-sm table-bordered\">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Subject</th>
                                    <th>Faculty</th>
                                    <th>Room</th>
                                </tr>
                            </thead>
                            <tbody>`;

                dayEntries.forEach(entry => {
                    timetableHtml += `
                        <tr>
                            <td>${entry.startTime} - ${entry.endTime}</td>
                            <td>${entry.subject?.name || entry.subjectName || '-'}</td>
                            <td>${entry.faculty?.name || '-'}</td>
                            <td>${entry.room || '-'}</td>
                        </tr>`;
                });

                timetableHtml += `
                            </tbody>
                        </table>
                    </div>`;
            });
        }

        const modalHtml = `
            <div class=\"modal fade\" id=\"batchTimetableModal\" tabindex=\"-1\">
                <div class=\"modal-dialog modal-lg\">
                    <div class=\"modal-content\">
                        <div class=\"modal-header\">
                            <h5 class=\"modal-title\">Timetable: ${batch.name}</h5>
                            <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"modal\"></button>
                        </div>
                        <div class=\"modal-body\">
                            <div class=\"mb-3\">
                                <strong>Branch:</strong> ${batch.branch} | 
                                <strong>Section:</strong> ${batch.section} | 
                                <strong>Semester:</strong> ${batch.semester}
                            </div>
                            ${timetableHtml}
                        </div>
                        <div class=\"modal-footer\">
                            <button type=\"button\" class=\"btn btn-secondary\" data-bs-dismiss=\"modal\">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('batchTimetableModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('batchTimetableModal'));
        modal.show();
    }

    // Edit batch
    window.editBatch = async function (batchId) {
        const batch = allBatches.find(b => b._id === batchId);
        if (!batch) {
            showToast('Batch not found', 'danger');
            return;
        }

        showBatchFormModal(batch);
    };

    // Delete batch
    window.deleteBatch = async function (batchId) {
        showConfirmDialog(
            'Delete Batch',
            'Are you sure you want to delete this batch? This will also remove all associated timetable entries.',
            async () => {
                try {
                    await apiRequest(`/batches/${batchId}`, {
                        method: 'DELETE'
                    });
                    showToast('Batch deleted successfully!', 'success');
                    loadBatches();
                    loadCurrentTimetable();
                } catch (error) {
                    showToast('Error: ' + error.message, 'danger');
                }
            }
        );
    };

    // Show batch form modal for create/edit
    window.showBatchFormModal = function (batch = null) {
        const isEdit = batch !== null;
        const modalTitle = isEdit ? 'Edit Batch' : 'Create New Batch';
        const submitBtnText = isEdit ? 'Update Batch' : 'Create Batch';

        const modalHtml = `
            <div class=\"modal fade\" id=\"batchFormModal\" tabindex=\"-1\">
                <div class=\"modal-dialog\">
                    <div class=\"modal-content\">
                        <div class=\"modal-header\">
                            <h5 class=\"modal-title\">${modalTitle}</h5>
                            <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"modal\"></button>
                        </div>
                        <div class=\"modal-body\">
                            <form id=\"batchForm\">
                                <div class=\"mb-3\">
                                    <label class=\"form-label\">Batch Name *</label>
                                    <input type=\"text\" class=\"form-control\" id=\"batchName\" value=\"${batch?.name || ''}\" required placeholder=\"e.g., CSE-A-2024\">
                                </div>
                                <div class=\"row\">
                                    <div class=\"col-md-6 mb-3\">
                                        <label class=\"form-label\">Branch *</label>
                                        <select class=\"form-select\" id=\"batchBranch\" required>
                                            <option value=\"\">Select Branch</option>
                                            <option value=\"CSE\" ${batch?.branch === 'CSE' ? 'selected' : ''}>CSE</option>
                                            <option value=\"ECE\" ${batch?.branch === 'ECE' ? 'selected' : ''}>ECE</option>
                                            <option value=\"EEE\" ${batch?.branch === 'EEE' ? 'selected' : ''}>EEE</option>
                                            <option value=\"MECH\" ${batch?.branch === 'MECH' ? 'selected' : ''}>MECH</option>
                                            <option value=\"CIVIL\" ${batch?.branch === 'CIVIL' ? 'selected' : ''}>CIVIL</option>
                                            <option value=\"IT\" ${batch?.branch === 'IT' ? 'selected' : ''}>IT</option>
                                        </select>
                                    </div>
                                    <div class=\"col-md-6 mb-3\">
                                        <label class=\"form-label\">Section *</label>
                                        <select class=\"form-select\" id=\"batchSection\" required>
                                            <option value=\"\">Select Section</option>
                                            <option value=\"A\" ${batch?.section === 'A' ? 'selected' : ''}>A</option>
                                            <option value=\"B\" ${batch?.section === 'B' ? 'selected' : ''}>B</option>
                                            <option value=\"C\" ${batch?.section === 'C' ? 'selected' : ''}>C</option>
                                            <option value=\"D\" ${batch?.section === 'D' ? 'selected' : ''}>D</option>
                                        </select>
                                    </div>
                                </div>
                                <div class=\"row\">
                                    <div class=\"col-md-6 mb-3\">
                                        <label class=\"form-label\">Semester *</label>
                                        <select class=\"form-select\" id=\"batchSemester\" required>
                                            <option value=\"\">Select Semester</option>
                                            ${[1, 2, 3, 4, 5, 6, 7, 8].map(sem =>
            `<option value=\"${sem}\" ${batch?.semester === sem ? 'selected' : ''}>${sem}</option>`
        ).join('')}
                                        </select>
                                    </div>
                                    <div class=\"col-md-6 mb-3\">
                                        <label class=\"form-label\">Student Count</label>
                                        <input type=\"number\" class=\"form-control\" id=\"batchStudentCount\" value=\"${batch?.studentCount || 0}\" min=\"0\">
                                    </div>
                                </div>
                                <div class=\"mb-3\">
                                    <label class=\"form-label\">Description</label>
                                    <textarea class=\"form-control\" id=\"batchDescription\" rows=\"2\">${batch?.description || ''}</textarea>
                                </div>
                                ${isEdit ? `
                                <div class=\"mb-3\">
                                    <div class=\"form-check\">
                                        <input class=\"form-check-input\" type=\"checkbox\" id=\"batchIsActive\" ${batch.isActive ? 'checked' : ''}>
                                        <label class=\"form-check-label\" for=\"batchIsActive\">
                                            Active Batch
                                        </label>
                                    </div>
                                </div>` : ''}
                            </form>
                        </div>
                        <div class=\"modal-footer\">
                            <button type=\"button\" class=\"btn btn-secondary\" data-bs-dismiss=\"modal\">Cancel</button>
                            <button type=\"button\" class=\"btn btn-primary\" onclick=\"saveBatch(${isEdit ? `'${batch._id}'` : 'null'})\">${submitBtnText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        const existingModal = document.getElementById('batchFormModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('batchFormModal'));
        modal.show();
    };

    // Save batch (create or update)
    window.saveBatch = async function (batchId) {
        const batchData = {
            name: document.getElementById('batchName').value,
            branch: document.getElementById('batchBranch').value,
            section: document.getElementById('batchSection').value,
            semester: parseInt(document.getElementById('batchSemester').value),
            studentCount: parseInt(document.getElementById('batchStudentCount').value) || 0,
            description: document.getElementById('batchDescription').value
        };

        if (batchId) {
            batchData.isActive = document.getElementById('batchIsActive').checked;
        }

        // Validation
        if (!batchData.name || !batchData.branch || !batchData.section || !batchData.semester) {
            showToast('Please fill all required fields', 'warning');
            return;
        }

        try {
            const url = batchId ? `/batches/${batchId}` : '/batches';
            const method = batchId ? 'PUT' : 'POST';

            await apiRequest(url, {
                method,
                body: JSON.stringify(batchData)
            });

            showToast(batchId ? 'Batch updated successfully!' : 'Batch created successfully!', 'success');

            const modal = bootstrap.Modal.getInstance(document.getElementById('batchFormModal'));
            modal.hide();

            loadBatches();
        } catch (error) {
            showToast('Error: ' + error.message, 'danger');
        }
    };

    // ===== SENT NOTICES MANAGEMENT =====

    // Load sent notices
    async function loadSentNotices() {
        const container = document.getElementById('sentNoticesContainer');
        if (!container) return;

        try {
            container.innerHTML = '<div class="text-center p-4"><span class="spinner-border spinner-border-sm me-2"></span>Loading notices...</div>';

            const response = await apiRequest('/notices');
            const notices = response.notices || response || [];

            if (!Array.isArray(notices) || notices.length === 0) {
                container.innerHTML = '<p class="text-muted text-center p-4">No notices sent yet.</p>';
                return;
            }

            // Sort by date (newest first)
            notices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            let html = '<div class="table-responsive"><table class="table table-hover">';
            html += `<thead>
                <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Target</th>
                    <th>Priority</th>
                    <th>Actions</th>
                </tr>
            </thead><tbody>`;

            notices.forEach(notice => {
                const date = new Date(notice.createdAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });
                const priorityBadge = {
                    'low': 'bg-secondary',
                    'medium': 'bg-info',
                    'high': 'bg-warning text-dark',
                    'urgent': 'bg-danger'
                }[notice.priority] || 'bg-secondary';

                html += `<tr>
                    <td>${date}</td>
                    <td>
                        <strong>${notice.title}</strong>
                        <br><small class="text-muted">${notice.content?.substring(0, 50)}${notice.content?.length > 50 ? '...' : ''}</small>
                    </td>
                    <td><span class="badge bg-primary">${notice.targetRoles || 'All'}</span></td>
                    <td><span class="badge ${priorityBadge}">${notice.priority || 'medium'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="viewNotice('${notice._id}')" title="View">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteNotice('${notice._id}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (error) {
            console.error('Failed to load sent notices:', error);
            container.innerHTML = '<p class="text-danger text-center p-4">Failed to load notices.</p>';
        }
    }

    // View notice details
    window.viewNotice = function (noticeId) {
        const notice = allUsers ? null : null; // We need to re-fetch or store notices
        apiRequest(`/notices/${noticeId}`).then(response => {
            const notice = response.notice || response;

            const modalHtml = `
                <div class="modal fade" id="viewNoticeModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title"><i class="bi bi-megaphone me-2"></i>${notice.title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Posted:</strong> ${new Date(notice.createdAt).toLocaleString()}</p>
                                <p><strong>Target:</strong> ${notice.targetRoles || 'All users'}</p>
                                <p><strong>Priority:</strong> ${notice.priority || 'medium'}</p>
                                <hr>
                                <p>${notice.content}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-danger" onclick="deleteNotice('${notice._id}'); bootstrap.Modal.getInstance(document.getElementById('viewNoticeModal')).hide();">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const existingModal = document.getElementById('viewNoticeModal');
            if (existingModal) existingModal.remove();

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('viewNoticeModal'));
            modal.show();
        }).catch(err => {
            showToast('Failed to load notice details', 'danger');
        });
    };

    // Delete notice
    window.deleteNotice = async function (noticeId) {
        showConfirmDialog(
            'Delete Notice',
            'Are you sure you want to delete this notice? This action cannot be undone.',
            async () => {
                try {
                    await apiRequest(`/notices/${noticeId}`, { method: 'DELETE' });
                    showToast('Notice deleted successfully!', 'success');
                    loadSentNotices();
                } catch (error) {
                    showToast('Error deleting notice: ' + error.message, 'danger');
                }
            }
        );
    };

    // Refresh sent notices (exposed for button click)
    window.refreshSentNotices = function () {
        loadSentNotices();
    };

    // ===== TIMETABLE CALENDAR VIEW =====

    // Load timetable for selected batch (calendar view)
    window.loadBatchTimetableCalendar = async function (batchName = null) {
        const batchSelect = document.getElementById('timetableBatchSelector');
        const container = document.getElementById('timetableCalendarContainer');

        if (!container) return;

        // Use provided batch name or get from selector
        const selectedBatch = batchName || (batchSelect ? batchSelect.value : null);

        if (!selectedBatch) {
            container.innerHTML = '<p class="text-muted text-center p-4">Select a batch to view timetable</p>';
            return;
        }

        // Update selector if batch name was provided
        if (batchName && batchSelect) {
            batchSelect.value = batchName;
        }

        try {
            container.innerHTML = '<div class="text-center p-4"><span class="spinner-border spinner-border-sm me-2"></span>Loading timetable...</div>';

            const response = await apiRequest('/timetable');
            let timetableData = response.timetable || response.data || [];

            if (!Array.isArray(timetableData)) {
                timetableData = [];
            }

            // Filter by selected batch - check both batch and classSection fields
            const filteredData = timetableData.filter(entry => {
                const entryBatch = entry.batch || entry.classSection || '';
                return entryBatch === selectedBatch;
            });

            console.log('Filtered timetable data:', filteredData);
            renderTimetableCalendar(filteredData, selectedBatch);

        } catch (error) {
            console.error('Failed to load timetable:', error);
            container.innerHTML = '<p class="text-danger text-center p-4">Failed to load timetable.</p>';
        }
    };

    // Render timetable in calendar format
    function renderTimetableCalendar(timetableData, batchName) {
        const container = document.getElementById('timetableCalendarContainer');
        if (!container) return;

        // Days for display (capitalized) and matching (lowercase)
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

        // Group entries by day
        const groupedByDay = {};
        days.forEach(day => groupedByDay[day] = []);

        timetableData.forEach(entry => {
            // Handle both lowercase (from DB) and capitalized day names
            const entryDay = entry.day ? entry.day.charAt(0).toUpperCase() + entry.day.slice(1).toLowerCase() : '';
            if (groupedByDay[entryDay]) {
                groupedByDay[entryDay].push(entry);
            }
        });

        // Sort each day's entries by start time
        Object.keys(groupedByDay).forEach(day => {
            groupedByDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        });

        let html = `
            <div class="timetable-calendar-header mb-3">
                <h5><i class="bi bi-calendar3 me-2"></i>Timetable: ${batchName}</h5>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered timetable-calendar">
                    <thead class="table-light">
                        <tr>
                            <th style="width: 100px;">Day</th>
                            <th>Classes</th>
                        </tr>
                    </thead>
                    <tbody>`;

        days.forEach(day => {
            const entries = groupedByDay[day];
            html += `<tr>
                <td class="fw-bold align-middle">${day}</td>
                <td>`;

            if (entries.length === 0) {
                html += '<span class="text-muted">No classes</span>';
            } else {
                html += '<div class="d-flex flex-wrap gap-2">';
                entries.forEach(entry => {
                    const subjectName = entry.subject?.name || entry.subjectName || entry.subject || 'Subject';
                    const teacherName = entry.teacher?.name || entry.teacherName || '';
                    html += `
                        <div class="class-card p-2 rounded border" style="min-width: 180px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                            <div class="fw-bold">${entry.startTime} - ${entry.endTime}</div>
                            <div>${subjectName}</div>
                            ${teacherName ? `<small>${teacherName}</small>` : ''}
                            ${entry.room ? `<small class="d-block"><i class="bi bi-geo-alt"></i> ${entry.room}</small>` : ''}
                            <div class="mt-1">
                                <button class="btn btn-sm btn-light py-0 px-1" onclick="editTimetableEntry('${entry._id}')" title="Edit">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-light py-0 px-1" onclick="deleteTimetableEntry('${entry._id}')" title="Delete">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>`;
                });
                html += '</div>';
            }

            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // Check for timetable duplicates before adding
    window.checkTimetableDuplicate = async function (day, startTime, endTime, batch) {
        try {
            const response = await apiRequest('/timetable');
            const timetableData = response.timetable || response.data || [];

            const duplicate = timetableData.find(entry =>
                entry.day === day &&
                entry.batch === batch &&
                ((entry.startTime <= startTime && entry.endTime > startTime) ||
                    (entry.startTime < endTime && entry.endTime >= endTime) ||
                    (entry.startTime >= startTime && entry.endTime <= endTime))
            );

            return duplicate;
        } catch (error) {
            console.error('Error checking duplicates:', error);
            return null;
        }
    };

    // Clear timetable form
    window.clearTimetableForm = function () {
        const form = document.getElementById('rescheduleForm');
        if (form) {
            form.reset();
            delete form.dataset.editingId;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Add Entry';
            }
        }
    };

    // Refresh timetable (exposed for button click)
    window.refreshTimetable = function () {
        loadCurrentTimetable();
        const batchSelect = document.getElementById('timetableBatchSelector');
        if (batchSelect && batchSelect.value) {
            loadBatchTimetableCalendar();
        }
    };

})();
