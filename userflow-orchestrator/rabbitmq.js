const amqp = require('amqplib');

let channel;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = 'user.signup'; // fanout exchange name
const GOOGLE_QUEUE = 'google.info';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const initRabbit = async () => {
  let retries = 5;
  while (retries) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, 'fanout', { durable: false }); // fanout exchange
      console.log('✅ Connected to RabbitMQ & exchange declared');
      return;
    } catch (err) {
      retries--;
      console.error(`❌ RabbitMQ not ready. Retrying in 5s... (${retries} attempts left)`);
      await sleep(5000);
    }
  }
  console.error('❌ Failed to connect to RabbitMQ after retries.');
};

const publishUserCreated = async (user) => {
  if (!channel) {
    console.warn('⚠️ RabbitMQ channel not available');
    return;
  }

  const message = {
    userId: user.id || user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId,
    userCode: user.userCode,
    password: user.password, // include with care — possibly hashed already?
    institutionId: user.institutionId
  };

  channel.publish(EXCHANGE_NAME, '', Buffer.from(JSON.stringify(message)));
  console.log('📤 Published signup event to fanout exchange:', message.email);
};

  const publishGoogleSignup = async ({ userCode, gmail, googleId }) => {
    if (!channel) {
      console.warn('⚠️ RabbitMQ channel not available');
      return;
    }

    const message = { userCode, gmail, googleId };

    // Assert the queue in case it's not created yet
    await channel.assertQueue(GOOGLE_QUEUE, { durable: false });

    // Send message directly to the named queue (not via exchange)
    channel.sendToQueue(GOOGLE_QUEUE, Buffer.from(JSON.stringify(message)));

    console.log('📤 Published Google signup info to google.info queue:', message);
  };

module.exports = {
  initRabbit,
  publishUserCreated,
  publishGoogleSignup
};
