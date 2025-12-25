// Password Reset Handler
(function () {
    'use strict';

    // Form submission handler
    document.getElementById('resetForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('resetEmail').value;

        // Validation
        if (!email) {
            alert('Please enter your email address');
            return;
        }

        try {
            // Call password reset API
            await AuthAPI.forgotPassword(email);

            // Show success message
            const successMsg = document.getElementById('successMessage');
            successMsg.style.display = 'block';

            // Hide form
            document.getElementById('resetForm').style.display = 'none';

            // Optionally redirect after 5 seconds
            // setTimeout(() => {
            //     window.location.href = 'login.html';
            // }, 5000);
        } catch (error) {
            console.error('Password reset error:', error);
            alert(error.message || 'Failed to send reset email. Please try again.');
        }
    });
})();
