const Event = require('../models/eventModel'); // change to your Event model file name
const User = require('../models/userModel');

// GET /admin/events/pending  -> the review queue, oldest first
exports.listPendingEvents = async (req, res) => {
    console.log('start list');
    
  try {
    const events = await Event.find({ approvalStatus: 'pending' })
      .sort({ createdAt: 1 })
      .populate('organizer', 'name email role');

    return res.status(200).json({ count: events.length, events });
  } catch (err) {
    console.error('List pending events error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// PATCH /admin/events/:id/approve 
exports.approveEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (event.approvalStatus !== 'pending') {
      return res.status(409).json({ message: `Only pending events can be approved (this one is ${event.approvalStatus})` });
    }

    event.approvalStatus = 'approved';
    event.rejectionReason = undefined;
    await event.save();

    // The owner becomes an organizer, but ONLY if they are a plain attendee.
    // (An organizer stays one; staff and admin accounts are never changed.)
    await User.updateOne({ _id: event.organizer, role: 'attendee' }, { role: 'organizer' });

    return res.status(200).json({ message: 'Event approved. The owner is now an organizer.', event });
  } catch (err) {
    console.error('Approve event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// PATCH /admin/events/:id/reject   body: { "reason": "..." }
exports.rejectEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (event.approvalStatus !== 'pending') {
      return res.status(409).json({ message: `Only pending events can be rejected (this one is ${event.approvalStatus})` });
    }

    event.approvalStatus = 'rejected';
    event.rejectionReason = req.body.reason;
    await event.save();

    // The owner's role is NOT changed
    return res.status(200).json({ message: 'Event rejected', event });
  } catch (err) {
    console.error('Reject event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};