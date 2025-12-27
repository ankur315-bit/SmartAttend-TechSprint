// Password Reset Handler
(function () {
    'use strict';

    // Get token from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');

    // Elements
    const resetForm = document.getElementById('resetForm');
    const newPasswordForm = document.getElementById('newPasswordForm');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const helpSection = document.getElementById('helpSection');

    // Show error message
    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }

    // Show success message
    function showSuccess(message) {
        successText.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    // If token is present, show the new password form
    if (resetToken) {
        pageTitle.textContent = 'Create New Password';
        pageSubtitle.textContent = 'Enter your new password below';
        resetForm.style.display = 'none';
        newPasswordForm.style.display = 'block';
        helpSection.style.display = 'none';

        // Password toggle functionality
        const toggleNewPassword = document.getElementById('toggleNewPassword');
        const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');

        if (toggleNewPassword) {
            toggleNewPassword.addEventListener('click', function () {
                const type = newPasswordInput.type === 'password' ? 'text' : 'password';
                newPasswordInput.type = type;
                this.querySelector('i').className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }

        if (toggleConfirmPassword) {
            toggleConfirmPassword.addEventListener('click', function () {
                const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
                confirmPasswordInput.type = type;
                this.querySelector('i').className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }

        // New password form submission
        newPasswordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validation
            if (!newPassword || !confirmPassword) {
                showError('Please fill in all fields');
                return;
            }

            if (newPassword.length < 6) {
                showError('Password must be at least 6 characters');
                return;
            }

            if (newPassword !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Resetting...';

            try {
                const response = await fetch(`/api/auth/reset-password/${resetToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: newPassword })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    newPasswordForm.style.display = 'none';
                    showSuccess('Password reset successfully! Redirecting to login...');

                    // Redirect to login after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/pages/login';
                    }, 2000);
                } else {
                    showError(data.message || 'Failed to reset password. The link may have expired.');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            } catch (error) {
                console.error('Password reset error:', error);
                showError('Failed to reset password. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    } else {
        // Request reset email form submission
        resetForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('resetEmail').value;

            // Validation
            if (!email) {
                showError('Please enter your email address');
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

            try {
                // Call password reset API
                await AuthAPI.forgotPassword(email);

                // Show success message
                showSuccess('Check your email for password reset instructions.');

                // Hide form
                resetForm.style.display = 'none';

            } catch (error) {
                console.error('Password reset error:', error);
                showError(error.message || 'Failed to send reset email. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
})();

