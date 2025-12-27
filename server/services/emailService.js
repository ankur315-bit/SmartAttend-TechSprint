const nodemailer = require('nodemailer');

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_ID || 'sayancodder731@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'fhep djny iclx hcil'
    }
});

// Verify transporter connection
transporter.verify((error, success) => {
    if (error) {
        console.error('Email service error:', error.message);
    } else {
        console.log('📧 Email service is ready');
    }
});

const EmailService = {
    // Send welcome email to new users
    async sendWelcomeEmail(user) {
        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: user.email,
            subject: 'Welcome to Smart Attendance System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">🎓 Smart Attendance</h1>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h2 style="color: #333;">Welcome, ${user.name}!</h2>
                        <p style="color: #666; line-height: 1.6;">
                            Your account has been successfully created in the Smart Attendance System.
                        </p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #333; margin-top: 0;">Account Details:</h3>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Role:</strong> ${user.role}</p>
                            ${user.rollNumber ? `<p><strong>Roll Number:</strong> ${user.rollNumber}</p>` : ''}
                            ${user.employeeId ? `<p><strong>Employee ID:</strong> ${user.employeeId}</p>` : ''}
                            <p><strong>Default Password:</strong> College@123</p>
                        </div>
                        <p style="color: #e74c3c; font-weight: bold;">
                            ⚠️ Please change your password after first login for security.
                        </p>
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}" 
                           style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; margin-top: 15px;">
                            Login Now
                        </a>
                    </div>
                    <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                        <p>Smart Attendance System - Making Attendance Easy</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Welcome email sent to ${user.email}`);
            return { success: true };
        } catch (error) {
            console.error('Welcome email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send attendance notification
    async sendAttendanceNotification(user, subject, status, date) {
        const statusColors = {
            present: '#28a745',
            absent: '#dc3545',
            late: '#ffc107'
        };

        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: user.email,
            subject: `Attendance Marked: ${subject} - ${status.toUpperCase()}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: ${statusColors[status] || '#667eea'}; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">Attendance Update</h2>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h3 style="color: #333;">Hello ${user.name},</h3>
                        <p style="color: #666;">Your attendance has been recorded:</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColors[status]};">
                            <p><strong>Subject:</strong> ${subject}</p>
                            <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> <span style="color: ${statusColors[status]}; font-weight: bold;">${status.toUpperCase()}</span></p>
                        </div>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (error) {
            console.error('Attendance email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send low attendance warning
    async sendLowAttendanceWarning(user, subject, percentage) {
        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: user.email,
            subject: `⚠️ Low Attendance Warning - ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #dc3545; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">⚠️ Low Attendance Warning</h2>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h3 style="color: #333;">Dear ${user.name},</h3>
                        <p style="color: #666;">Your attendance in <strong>${subject}</strong> is below the required threshold.</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
                            <h1 style="color: #dc3545; margin: 0;">${percentage}%</h1>
                            <p style="color: #666; margin: 5px 0 0 0;">Current Attendance</p>
                        </div>
                        <p style="color: #e74c3c; margin-top: 20px;">
                            Required minimum attendance is <strong>75%</strong>. Please ensure regular attendance to avoid academic penalties.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (error) {
            console.error('Low attendance email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send notice notification
    async sendNoticeNotification(users, notice) {
        const priorityColors = {
            high: '#dc3545',
            medium: '#ffc107',
            low: '#28a745'
        };

        const emailPromises = users.map(user => {
            const mailOptions = {
                from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
                to: user.email,
                subject: `📢 New Notice: ${notice.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: ${priorityColors[notice.priority] || '#667eea'}; padding: 20px; text-align: center;">
                            <h2 style="color: white; margin: 0;">📢 New Notice</h2>
                        </div>
                        <div style="padding: 30px; background: #f8f9fa;">
                            <h3 style="color: #333;">${notice.title}</h3>
                            <p style="color: #666; line-height: 1.6;">${notice.content}</p>
                            <div style="margin-top: 20px; padding: 10px; background: #e9ecef; border-radius: 5px;">
                                <small style="color: #666;">
                                    Priority: <strong>${notice.priority.toUpperCase()}</strong> | 
                                    Posted: ${new Date(notice.createdAt).toLocaleString()}
                                </small>
                            </div>
                        </div>
                    </div>
                `
            };
            return transporter.sendMail(mailOptions).catch(err => ({ error: err.message, email: user.email }));
        });

        try {
            const results = await Promise.all(emailPromises);
            const failed = results.filter(r => r && r.error);
            return {
                success: true,
                sent: users.length - failed.length,
                failed: failed.length
            };
        } catch (error) {
            console.error('Notice email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send password reset email
    async sendPasswordResetEmail(user, resetToken) {
        // Determine the correct app URL based on environment
        const appUrl = process.env.NODE_ENV === 'production'
            ? (process.env.APP_URL_PROD || process.env.APP_URL)
            : (process.env.APP_URL_DEV || process.env.APP_URL || 'http://localhost:3000');

        const resetUrl = `${appUrl}/pages/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #667eea; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">Password Reset</h2>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h3 style="color: #333;">Hello ${user.name},</h3>
                        <p style="color: #666;">We received a request to reset your password. Click the button below to create a new password:</p>
                        <a href="${resetUrl}" 
                           style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; margin: 20px 0;">
                            Reset Password
                        </a>
                        <p style="color: #999; font-size: 12px;">
                            This link will expire in 1 hour. If you didn't request this, please ignore this email.
                        </p>
                        <p style="color: #999; font-size: 12px; margin-top: 20px;">
                            Or copy and paste this link in your browser:<br>
                            <span style="color: #667eea; word-break: break-all;">${resetUrl}</span>
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (error) {
            console.error('Password reset email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send OTP for password change verification
    async sendPasswordChangeOTP(user, otp) {
        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: user.email,
            subject: 'Password Change Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">🔐 Verification Code</h1>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h3 style="color: #333;">Hello ${user.name},</h3>
                        <p style="color: #666;">You requested to change your password. Use the verification code below:</p>
                        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; margin: 30px 0; border: 2px dashed #667eea;">
                            <h1 style="color: #667eea; font-size: 40px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
                        </div>
                        <p style="color: #e74c3c; font-weight: bold;">
                            ⚠️ This code expires in 10 minutes. Do not share this code with anyone.
                        </p>
                        <p style="color: #999; font-size: 12px; margin-top: 20px;">
                            If you didn't request this password change, please ignore this email and your password will remain unchanged.
                        </p>
                    </div>
                    <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                        <p>Smart Attendance System - Making Attendance Easy</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Password change OTP sent to ${user.email}`);
            return { success: true };
        } catch (error) {
            console.error('Password change OTP email error:', error.message);
            return { success: false, error: error.message };
        }
    },

    // Send custom email from admin
    async sendCustomEmail(email, subject, message) {
        const mailOptions = {
            from: `"Smart Attendance System" <${process.env.EMAIL_ID || 'sayancodder731@gmail.com'}>`,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">📧 Smart Attendance</h1>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h2 style="color: #333;">${subject}</h2>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="color: #666; line-height: 1.8; white-space: pre-wrap;">${message}</p>
                        </div>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">
                            This is an official email from Smart Attendance System.
                        </p>
                    </div>
                    <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                        <p>Smart Attendance System - Making Attendance Easy</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Custom email sent to ${email}`);
            return { success: true };
        } catch (error) {
            console.error('Custom email error:', error.message);
            return { success: false, error: error.message };
        }
    }
};

module.exports = EmailService;
