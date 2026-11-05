const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Tier name is required"], trim: true },
  price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
  capacity: {
    type: Number,
    required: true,
    min: [1, "Capacity must be at least 1"],
  },
  sold: { type: Number, default: 0, min: 0 },
});

tierSchema.virtual("remaining").get(function () {
  return this.capacity - this.sold;
});

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },
    description: { type: String, trim: true },
    posterUrl: { type: String, trim: true },
    posterPublicId: { type: String, trim: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, trim: true },
    venue: { type: String, trim: true },
    city: { type: String, trim: true },
    date: { type: Date, required: [true, "Event date is required"] },
    endDate: { type: Date, required: [true, "End date is required"] },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tiers: {
      type: [tierSchema],
      validate: [
        {
          validator: (tiers) => tiers.length > 0,
          message: "An event needs at least one ticket tier",
        },
        {
          validator: (tiers) =>
            new Set(tiers.map((t) => t.name)).size === tiers.length,
          message: "Tier names must be unique within an event",
        },
      ],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

eventSchema.pre("validate", function () {
  if (this.date && this.endDate && this.endDate <= this.date) {
    this.invalidate("endDate", "End date must be after the start date");
  }
});

eventSchema.virtual("status").get(function () {
  const now = new Date();
  if (now < this.date) return "upcoming";
  if (now <= this.endDate) return "live";
  return "ended";
});

eventSchema.virtual("totalRemaining").get(function () {
  return this.tiers.reduce((sum, t) => sum + (t.capacity - t.sold), 0);
});

eventSchema.set("toJSON", { virtuals: true });
tierSchema.set("toJSON", { virtuals: true });

eventSchema.statics.reserveSeats = async function (
  eventId,
  tierName,
  quantity,
) {
  const event = await this.findById(eventId).select("tiers");
  const tier = event && event.tiers.find((t) => t.name === tierName);
  if (!tier) return null;

  const result = await this.updateOne(
    {
      _id: eventId,
      tiers: {
        $elemMatch: {
          name: tierName,
          sold: { $lte: tier.capacity - quantity },
        },
      },
    },
    { $inc: { "tiers.$.sold": quantity } },
  );
  return result.modifiedCount === 1;
};

eventSchema.statics.releaseSeats = function (eventId, tierName, quantity = 1) {
  return this.updateOne(
    { _id: eventId, "tiers.name": tierName },
    { $inc: { "tiers.$.sold": -quantity } },
  );
};

eventSchema.index({ city: 1, date: 1 });
eventSchema.index({ organizer: 1 });

module.exports = mongoose.model("Event", eventSchema);
