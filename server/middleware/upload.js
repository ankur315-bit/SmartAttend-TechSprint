const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Storage configuration for profile images
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profiles/');
    },
    filename: function (req, file, cb) {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Storage configuration for face verification images
const faceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/faces/');
    },
    filename: function (req, file, cb) {
        const uniqueName = `face_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Storage configuration for notice attachments
const noticeStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/notices/');
    },
    filename: function (req, file, cb) {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('File type not allowed!'), false);
    }
};

// Export upload configurations
exports.uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: imageFilter
});

exports.uploadFace = multer({
    storage: faceStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFilter
});

exports.uploadNotice = multer({
    storage: noticeStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: documentFilter
});
