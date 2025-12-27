// Configuration for each role
const roleConfig = {
    student: {
        icon: 'bi-mortarboard-fill',
        title: 'Welcome Back',
        subtitle: 'Sign in to your student account',
        forgotPasswordUrl: './reset-password?role=student',
        contactText: 'Need help? Contact your course coordinator',
        brandFooter: 'Smart Attendance System - Student Portal',
        endpoint: '/api/auth/login',
        dashboardUrl: './student-dashboard'
    },
    faculty: {
        icon: 'bi-person-workspace',
        title: 'Faculty Portal',
        subtitle: 'Sign in to manage your classes',
        forgotPasswordUrl: './reset-password?role=faculty',
        contactText: 'Need help? Contact IT Support',
        brandFooter: 'Smart Attendance System - Faculty Portal',
        endpoint: '/api/auth/login',
        dashboardUrl: './faculty-dashboard'
    },
    admin: {
        icon: 'bi-shield-lock-fill',
        title: 'Admin Portal',
        subtitle: 'System Administration',
        forgotPasswordUrl: './reset-password?role=admin',
        contactText: 'Authorized personnel only',
        brandFooter: 'Smart Attendance System - Admin Access',
        endpoint: '/api/auth/login',
        dashboardUrl: './admin-dashboard'
    }
};

let currentRole = 'student'; // Default role

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Get role from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');

    if (roleParam && roleConfig[roleParam]) {
        currentRole = roleParam;
    }

    // Set active tab
    updateActiveTab(currentRole);

    // Update UI for current role
    updateRoleUI(currentRole);

    // Add event listeners to tabs
    const tabs = document.querySelectorAll('.nav-tabs-login a');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const role = tab.getAttribute('data-role');
            if (role) {
                switchRole(role);
            }
        });
    });

    // Add form submit listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Check if already logged in
    checkExistingSession();
});

// Update active tab highlighting
function updateActiveTab(role) {
    const tabs = document.querySelectorAll('.nav-tabs-login a');
    tabs.forEach(tab => {
        const tabRole = tab.getAttribute('data-role');
        if (tabRole === role) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// Switch to a different role
function switchRole(role) {
    currentRole = role;

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('role', role);
    window.history.pushState({}, '', url);

    // Update UI
    updateActiveTab(role);
    updateRoleUI(role);
}

// Update UI elements for the current role
function updateRoleUI(role) {
    const config = roleConfig[role];

    // Update data-role attribute on body
    document.body.setAttribute('data-role', role);

    // Update icon
    const roleIcon = document.getElementById('roleIcon');
    if (roleIcon) {
        roleIcon.className = config.icon;
    }

    // Update title
    const roleTitle = document.getElementById('roleTitle');
    if (roleTitle) {
        roleTitle.textContent = config.title;
    }

    // Update subtitle
    const roleSubtitle = document.getElementById('roleSubtitle');
    if (roleSubtitle) {
        roleSubtitle.textContent = config.subtitle;
    }

    // Update forgot password link
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.href = config.forgotPasswordUrl;
    }

    // Update contact text
    const contactText = document.getElementById('contactText');
    if (contactText) {
        contactText.textContent = config.contactText;
    }

    // Update brand footer
    const brandFooter = document.getElementById('brandFooter');
    if (brandFooter) {
        brandFooter.textContent = config.brandFooter;
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // Basic validation
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

    try {
        const config = roleConfig[currentRole];
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            // Verify that the logged-in user's role matches the selected role
            if (data.user && data.user.role !== currentRole) {
                showError(`This account is not registered as a ${currentRole}. Please select the correct role.`);
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }

            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }

            // Show success message briefly
            showSuccess('Login successful! Redirecting...');

            // Redirect to appropriate dashboard
            setTimeout(() => {
                window.location.href = config.dashboardUrl;
            }, 500);

        } else {
            showError(data.message || 'Invalid credentials. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }

    } catch (error) {
        console.error('Login error:', error);
        showError('Connection error. Please check your internet connection and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Check if user is already logged in
function checkExistingSession() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            const config = roleConfig[user.role];

            if (config) {
                // User is already logged in, redirect to dashboard
                window.location.href = config.dashboardUrl;
            }
        } catch (error) {
            // Invalid stored data, clear it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
}

// Show error message
function showError(message) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create new alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert before form
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(alert, form);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }
    }, 5000);
}

// Show success message
function showSuccess(message) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create new alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
        <i class="bi bi-check-circle-fill me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert before form
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(alert, form);
}
