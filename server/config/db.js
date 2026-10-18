import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is missing. Add it to server/.env");
  }

  await mongoose.connect(uri);
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}
