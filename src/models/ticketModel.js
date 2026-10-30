const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
   
    code:
     { type: String,
         required: true,
          unique: true 
        },
    event: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', required: true 
    },
    attendee: { 
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tierName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, 
    status: {
      type: String,
      enum: ['valid', 'used', 'cancelled'],
      default: 'valid',
    },
    usedAt: { type: Date },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);


ticketSchema.statics.markUsed = function (code, staffId) {
  return this.findOneAndUpdate(
    { code, status: 'valid' },
    { status: 'used', usedAt: new Date(), usedBy: staffId },
    { new: true }
  );
};

ticketSchema.index({ attendee: 1 });
ticketSchema.index({ event: 1, createdAt: 1 });

ticketSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);