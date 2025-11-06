const mongoose = require('mongoose');

async function clearDatabase() {
  const { collections } = mongoose.connection;
  const tasks = [];
  for (const key of Object.keys(collections)) {
    const collection = collections[key];
    tasks.push(collection.deleteMany({}).catch(() => {}));
  }
  await Promise.all(tasks);
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close().catch(() => {});
}

module.exports = {
  clearDatabase,
  closeDatabase,
};
