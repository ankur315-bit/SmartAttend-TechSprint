const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
