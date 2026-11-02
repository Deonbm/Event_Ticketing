const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["attendee", "organizer", "staff", "admin"],
      default: "attendee",
    },
    isApproved: {
    type: Boolean,
    default: false,   
    },
    hostRequested: {
    type: Boolean,
    default: false,   
    },
    RefreshToken:{
    type: String,
    default: null,
    select: false
}
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// userSchema.set("toJSON", {
//   transform: (doc, ret) => {
//     delete ret.password;
//     delete ret.__v;
//     return ret;
//   },
// });

const User = mongoose.model("User", userSchema);

module.exports = User;
