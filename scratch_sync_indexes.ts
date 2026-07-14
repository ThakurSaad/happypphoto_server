import mongoose from 'mongoose';
import User from './src/app/module/user/User';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    const uri = process.env.DATABASE_URL || "mongodb://localhost:27017/happyPhotoDB";
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    console.log("Syncing indexes for User collection...");
    await User.syncIndexes();
    console.log("Indexes synced successfully.");
    
    const indexes = await User.collection.indexes();
    console.log("Current indexes:", indexes);
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

run();
