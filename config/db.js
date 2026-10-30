const mongoose = require('mongoose');
module.exports = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackq');
  console.log('MongoDB connected');
};
