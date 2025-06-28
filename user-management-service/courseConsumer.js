const amqp = require('amqplib');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'coursesAuth'; // 👈 fixed: using coursesAuth directly

const initConsumer = async () => {
  // Connect to MongoDB
  await connectDB();

  let retries = 10;
  while (retries) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      // Ensure queue exists
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      console.log(`✅ Listening on "${QUEUE_NAME}" queue...`);

      channel.consume(QUEUE_NAME, async (message) => {
        if (message) {
          try {
            const userData = JSON.parse(message.content.toString());
            console.log('📥 Received message:', userData);

            await processUserSignup(userData);

            // Acknowledge message
            channel.ack(message);
            console.log('✅ User processed successfully:', userData.email);

          } catch (error) {
            console.error('❌ Error processing message:', error.message);
            channel.nack(message, false, false); // Don't requeue
          }
        }
      });

      return;
    } catch (err) {
      retries--;
      console.error(`❌ RabbitMQ not ready. Retrying in 5s... (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.error('❌ Failed to connect to RabbitMQ after retries.');
  process.exit(1);
};

const processUserSignup = async (data) => {
  const {
    courseId,
    courseName,
    academicPeriod,
    instructorId,
    studentUserCodes
  } = data;

  if (!courseId || !studentUserCodes || studentUserCodes.length === 0) {
    console.warn('⚠️ Missing courseId or empty studentUserCodes');
    return;
  }

  const course = { courseId, courseName, academicPeriod };

  try {
    // 1. Fetch student users
    const users = await User.find({ userCode: { $in: studentUserCodes } });

    for (const user of users) {
      const alreadyAdded = user.courses.some(
        (c) => c.courseId === courseId && c.academicPeriod === academicPeriod
      );

      if (!alreadyAdded) {
        user.courses.push(course);
        await user.save();
        console.log(`✅ Course added to student ${user.userCode}`);
      } else {
        console.log(`ℹ️ Course already exists for student ${user.userCode}`);
      }
    }

    // 2. Also update instructor (if found)
    const instructor = await User.findOne({ userCode: instructorId, role: 'instructor' });

    if (instructor) {
      const alreadyAdded = instructor.courses.some(
        (c) => c.courseId === courseId && c.academicPeriod === academicPeriod
      );

      if (!alreadyAdded) {
        instructor.courses.push(course);
        await instructor.save();
        console.log(`✅ Course added to instructor ${instructor.userCode}`);
      } else {
        console.log(`ℹ️ Course already exists for instructor ${instructor.userCode}`);
      }
    } else {
      console.log(`⚠️ Instructor with userCode ${instructorId} not found`);
    }

    console.log(`📚 Finished updating course "${courseId}" for ${users.length} students and instructor`);

  } catch (err) {
    console.error('❌ Error updating user courses:', err.message);
  }
};



// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down consumer...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('📴 Shutting down consumer...');
  process.exit(0);
});

// Start consumer
initConsumer().catch(console.error);
