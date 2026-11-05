// Creates the admin account (the register form can never create one).
// 1. Put ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env
// 2. Run from the project root:  node src/seedAdmin.js
// 3. Afterwards, remove ADMIN_PASSWORD from .env
require('dotenv').config();
const mongoose = require('mongoose');
const dbConnect = require('./config/db');
const User = require('./models/userModel');

(async () => {
  try {
    await dbConnect();

    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first');
      return;
    }

    const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existing) {
      console.log('A user with this email already exists. Nothing changed.');
      return;
    }

    // The password is hashed by the pre('save') hook in the model
    await new User({
      name: ADMIN_NAME || 'Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    }).save();

    console.log('Admin created:', ADMIN_EMAIL);
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
})();