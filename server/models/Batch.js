const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Batch name is required'],
        unique: true,
        trim: true
    },
    semester: {
        type: Number,
        required: [true, 'Semester is required'],
        min: 1,
        max: 8
    },
    branch: {
        type: String,
        required: [true, 'Branch is required'],
        trim: true
    },
    section: {
        type: String,
        required: [true, 'Section is required'],
        trim: true
    },
    academicYear: {
        type: String,
        default: () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        }
    },
    studentCount: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes for better query performance
batchSchema.index({ name: 1 });
batchSchema.index({ semester: 1, branch: 1, section: 1 });
batchSchema.index({ isActive: 1 });

// Virtual for display name
batchSchema.virtual('displayName').get(function () {
    return `${this.branch}-${this.section} (Sem ${this.semester})`;
});

// Method to get full batch details
batchSchema.methods.getFullInfo = function () {
    return {
        id: this._id,
        name: this.name,
        displayName: this.displayName,
        semester: this.semester,
        branch: this.branch,
        section: this.section,
        academicYear: this.academicYear,
        studentCount: this.studentCount,
        isActive: this.isActive
    };
};

module.exports = mongoose.model('Batch', batchSchema);
