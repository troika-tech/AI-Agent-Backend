const dotenv = require('dotenv');
const connectDB = require('../db');
const IntelligentIntent = require('../models/IntelligentIntent');

dotenv.config();

async function seedIntents() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Seeding intelligent intents...');
    await IntelligentIntent.seedIntents();

    console.log('✓ Intelligent intents seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding intents:', error);
    process.exit(1);
  }
}

seedIntents();
