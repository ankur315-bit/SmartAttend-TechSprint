// ===== Smart Attendance System - Database Seeder =====
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Subject = require('./models/Subject');
const Timetable = require('./models/Timetable');
const Notice = require('./models/Notice');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance';

async function seedDatabase() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        console.log('🗑️ Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Subject.deleteMany({}),
            Timetable.deleteMany({}),
            Notice.deleteMany({})
        ]);
        console.log('✅ Existing data cleared');

        // Create Admin
        console.log('👤 Creating admin user...');
        const admin = await User.create({
            name: 'System Admin',
            email: 'admin@smartattendance.com',
            password: 'admin123',
            role: 'admin',
            department: 'Administration',
            isActive: true
        });
        console.log(`   ✅ Admin: ${admin.email} / admin123`);

        // Create Faculty
        console.log('👨‍🏫 Creating faculty users...');
        const faculty1 = await User.create({
            name: 'Dr. Rajesh Kumar',
            email: 'rajesh@smartattendance.com',
            password: 'faculty123',
            role: 'faculty',
            department: 'Computer Science',
            isActive: true
        });

        const faculty2 = await User.create({
            name: 'Prof. Priya Sharma',
            email: 'priya@smartattendance.com',
            password: 'faculty123',
            role: 'faculty',
            department: 'Computer Science',
            isActive: true
        });

        const faculty3 = await User.create({
            name: 'Dr. Amit Patel',
            email: 'amit@smartattendance.com',
            password: 'faculty123',
            role: 'faculty',
            department: 'Electronics',
            isActive: true
        });

        console.log(`   ✅ Faculty: ${faculty1.email} / faculty123`);
        console.log(`   ✅ Faculty: ${faculty2.email} / faculty123`);
        console.log(`   ✅ Faculty: ${faculty3.email} / faculty123`);

        // Create Students
        console.log('🎓 Creating student users...');
        const students = [];
        const studentData = [
            { name: 'Kshitij Patel', rollNumber: '2025001', email: 'kshitij@student.edu' },
            { name: 'Aarav Mehta', rollNumber: '2025002', email: 'aarav@student.edu' },
            { name: 'Sneha Reddy', rollNumber: '2025003', email: 'sneha@student.edu' },
            { name: 'Rohan Singh', rollNumber: '2025004', email: 'rohan@student.edu' },
            { name: 'Ananya Gupta', rollNumber: '2025005', email: 'ananya@student.edu' },
            { name: 'Vikram Joshi', rollNumber: '2025006', email: 'vikram@student.edu' },
            { name: 'Priyanka Verma', rollNumber: '2025007', email: 'priyanka@student.edu' },
            { name: 'Arjun Nair', rollNumber: '2025008', email: 'arjun@student.edu' },
            { name: 'Diya Sharma', rollNumber: '2025009', email: 'diya@student.edu' },
            { name: 'Kabir Das', rollNumber: '2025010', email: 'kabir@student.edu' }
        ];

        for (const data of studentData) {
            const student = await User.create({
                name: data.name,
                email: data.email,
                password: 'student123',
                role: 'student',
                rollNumber: data.rollNumber,
                department: 'Computer Science',
                semester: 3,
                batch: '2025',
                isActive: true
            });
            students.push(student);
        }
        console.log(`   ✅ Created ${students.length} students (password: student123)`);

        // Create Subjects
        console.log('📚 Creating subjects...');
        const subjects = await Subject.create([
            {
                name: 'Data Structures & Algorithms',
                code: 'CS301',
                branch: 'CSE',
                semester: 3,
                credits: 4,
                faculty: faculty1._id
            },
            {
                name: 'Database Management Systems',
                code: 'CS302',
                branch: 'CSE',
                semester: 3,
                credits: 4,
                faculty: faculty2._id
            },
            {
                name: 'Operating Systems',
                code: 'CS303',
                branch: 'CSE',
                semester: 3,
                credits: 3,
                faculty: faculty1._id
            },
            {
                name: 'Computer Networks',
                code: 'CS304',
                branch: 'CSE',
                semester: 3,
                credits: 3,
                faculty: faculty2._id
            },
            {
                name: 'Digital Electronics',
                code: 'EC301',
                branch: 'ECE',
                semester: 3,
                credits: 3,
                faculty: faculty3._id
            }
        ]);
        console.log(`   ✅ Created ${subjects.length} subjects`);

        // Assign subjects to faculty
        faculty1.subjects = [subjects[0]._id, subjects[2]._id];
        faculty2.subjects = [subjects[1]._id, subjects[3]._id];
        faculty3.subjects = [subjects[4]._id];
        await Promise.all([faculty1.save(), faculty2.save(), faculty3.save()]);

        // Create Timetable
        console.log('📅 Creating timetable...');
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

        const timetableEntries = [];
        for (const day of days) {
            // Morning slots
            timetableEntries.push({
                day: day,
                startTime: '09:00',
                endTime: '10:00',
                subject: subjects[0]._id,
                faculty: faculty1._id,
                room: 'Room 101',
                semester: 3,
                branch: 'CSE',
                section: 'A'
            });

            timetableEntries.push({
                day: day,
                startTime: '10:00',
                endTime: '11:00',
                subject: subjects[1]._id,
                faculty: faculty2._id,
                room: 'Room 102',
                semester: 3,
                branch: 'CSE',
                section: 'A'
            });

            timetableEntries.push({
                day: day,
                startTime: '11:15',
                endTime: '12:15',
                subject: subjects[2]._id,
                faculty: faculty1._id,
                room: 'Lab 1',
                semester: 3,
                branch: 'CSE',
                section: 'A'
            });
        }

        await Timetable.create(timetableEntries);
        console.log(`   ✅ Created ${timetableEntries.length} timetable entries`);

        // Create Notices
        console.log('📢 Creating notices...');
        await Notice.create([
            {
                title: 'Welcome to Smart Attendance System',
                content: 'Welcome to our new WiFi-based attendance system. Please ensure you have registered your face and device for seamless attendance marking.',
                type: 'general',
                priority: 'high',
                createdBy: admin._id,
                targetAudience: { roles: ['all'] },
                isActive: true
            },
            {
                title: 'Attendance Policy Update',
                content: 'Minimum 75% attendance is mandatory for all students. Students below this threshold will not be eligible for examinations.',
                type: 'academic',
                priority: 'high',
                createdBy: admin._id,
                targetAudience: { roles: ['student'] },
                isActive: true
            },
            {
                title: 'Faculty Training Session',
                content: 'Training session on using the new attendance system will be held on Friday at 3 PM in the Conference Room.',
                type: 'event',
                priority: 'medium',
                createdBy: admin._id,
                targetAudience: { roles: ['faculty'] },
                isActive: true
            },
            {
                title: 'Geofencing Range Updated',
                content: 'The geofencing radius has been updated to 50 meters. Please ensure you are within the classroom area when marking attendance.',
                type: 'general',
                priority: 'medium',
                createdBy: admin._id,
                targetAudience: { roles: ['all'] },
                isActive: true
            }
        ]);
        console.log('   ✅ Created sample notices');

        // Summary
        console.log('\n========================================');
        console.log('🎉 Database seeded successfully!');
        console.log('========================================\n');
        console.log('📧 Login Credentials:');
        console.log('----------------------------------------');
        console.log('Admin:   admin@smartattendance.com / admin123');
        console.log('Faculty: rajesh@smartattendance.com / faculty123');
        console.log('Faculty: priya@smartattendance.com / faculty123');
        console.log('Student: kshitij@student.edu / student123');
        console.log('         (and 9 more students...)');
        console.log('----------------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
