const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'faculty', 'student'],
        required: true
    },
    // Student specific fields
    rollNumber: {
        type: String,
        sparse: true
    },
    semester: {
        type: Number,
        min: 1,
        max: 8
    },
    branch: {
        type: String,
        enum: ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil', 'EEE', 'MECH', 'CIVIL']
    },
    section: String,
    batch: {
        type: String,
        default: ''
    },
    // Additional student profile fields
    admissionNumber: String,
    registrationId: String,
    degree: {
        type: String,
        default: 'BE'
    },
    dateOfBirth: Date,
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', '']
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', '']
    },
    fatherName: String,
    motherName: String,
    personalEmail: String,
    currentAddress: String,
    permanentAddress: String,
    // Faculty specific fields
    employeeId: String,
    department: String,
    designation: String,
    // Common fields
    phone: String,
    profileImage: {
        type: String,
        default: ''
    },
    faceEncoding: {
        type: [Number],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    // User preferences
    preferences: {
        darkMode: { type: Boolean, default: false },
        emailNotifications: { type: Boolean, default: true }
    },
    // Password reset fields
    passwordResetToken: String,
    passwordResetExpires: Date,
    // Email verification fields
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    // Password change verification
    passwordChangeOTP: String,
    passwordChangeOTPExpires: Date,
    lastLogin: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.passwordResetExpires = Date.now() + (process.env.PASSWORD_RESET_EXPIRE || 3600000); // 1 hour default

    return resetToken;
};

// Generate OTP for password change verification
userSchema.methods.generatePasswordChangeOTP = function () {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    this.passwordChangeOTP = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');

    this.passwordChangeOTPExpires = Date.now() + 600000; // 10 minutes

    return otp;
};

// Verify OTP
userSchema.methods.verifyPasswordChangeOTP = function (otp) {
    const hashedOTP = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');

    return this.passwordChangeOTP === hashedOTP && this.passwordChangeOTPExpires > Date.now();
};

// Get full profile
userSchema.methods.getProfile = function () {
    const profile = {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        profileImage: this.profileImage,
        isActive: this.isActive
    };

    if (this.role === 'student') {
        profile.rollNumber = this.rollNumber;
        profile.semester = this.semester;
        profile.branch = this.branch;
        profile.section = this.section;
        profile.batch = this.batch;
    } else if (this.role === 'faculty') {
        profile.employeeId = this.employeeId;
        profile.department = this.department;
        profile.designation = this.designation;
    }

    return profile;
};

module.exports = mongoose.model('User', userSchema);
