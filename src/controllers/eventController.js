const Event = require('../models/eventModel');

const {uploadImage,deleteImage} =require('../utils/cloudinaryUpload')

exports.createEvent = async (req, res) => {
  let poster = {};
  console.log('req.user:', req.user);
 
  try {
     
    if (req.file) {
      try {
        const result = await uploadImage(req.file.buffer);
        poster = { posterUrl: result.secure_url, posterPublicId: result.public_id };
      } catch (uploadErr) {
        console.error('Poster upload error:', uploadErr);
        return res.status(502).json({ message: 'Could not upload the poster. Please try again.' });
      }
    }   
     
    const approvalStatus = req.user.role === 'organizer' ? 'approved' : 'pending';
 
    const event = new Event({
      ...req.body,
      ...poster,
      organizer: req.user.id,
      approvalStatus,
    });
    await event.save();
 
    return res.status(201).json({
      message:
        approvalStatus === 'approved'
          ? 'Event created'
          : 'Event submitted. It will be public after admin approval.',
      event,
    });
  } catch (err) {
     
    await deleteImage(poster.posterPublicId);
 
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Create event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.listEvents = async (req, res) => {
  try {
    // Clean values from validate(listEventsQuerySchema, 'query'); falls back to the raw query
    const { city, q, status, page, limit } = req.validated?.query || req.query;
    const pageNum = Math.max(Number(page) || 1, 1);               // page starts at 1
    const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50); // 12 per page, never more than 50
    const now = new Date();
 
    // 1. Only APPROVED events are public
    const filter = { approvalStatus: 'approved' };
 
    // 2. Status filter. With no status given, hide events that have already ended.
    if (status === 'upcoming') filter.date = { $gt: now };
    else if (status === 'live') {
      filter.date = { $lte: now };
      filter.endDate = { $gte: now };
    } else if (status === 'ended') filter.endDate = { $lt: now };
    else filter.endDate = { $gte: now };
 
    // 3. City: exact match, ignoring upper/lower case
    if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
 
    // 4. Keyword: partial match in the title or the description
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }
 
    // 5. Get one page of events (soonest first) and the total number of matches
    const [events, total] = await Promise.all([
      Event.find(filter)
        .select('title posterUrl city venue date endDate tiers organizer') // a light list, no full description
        .populate('organizer', 'name') // only the organizer's name
        .sort({ date: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Event.countDocuments(filter),
    ]);
 
    // 6. Shape each event for the home page cards
    const items = events.map((e) => ({
      id: e._id,
      title: e.title,
      posterUrl: e.posterUrl,
      city: e.city,
      venue: e.venue,
      date: e.date,
      endDate: e.endDate,
      status: e.status,                                    // upcoming / live / ended
      fromPrice: Math.min(...e.tiers.map((t) => t.price)), // cheapest tier
      totalRemaining: e.totalRemaining,                    // for the "12 left" badge
      organizer: e.organizer ? e.organizer.name : null,
    }));
 
    return res.status(200).json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      events: items,
    });
  } catch (err) {
    console.error('List events error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.getEvent = async (req, res) => {
  try {
    // Pending and rejected events are treated as "not found", so nobody can peek at them
    const event = await Event.findOne({ _id: req.params.id, approvalStatus: 'approved' })
      .populate('organizer', 'name'); // only the organizer's name
 
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
 
    return res.status(200).json({
      event: {
        id: event._id,
        title: event.title,
        description: event.description,
        posterUrl: event.posterUrl,
        city: event.city,
        venue: event.venue,
        date: event.date,
        endDate: event.endDate,
        status: event.status,                  // upcoming / live / ended
        totalRemaining: event.totalRemaining,
        organizer: event.organizer ? event.organizer.name : null,
        // Public view of each tier: price and how many are left (not how many were sold)
        tiers: event.tiers.map((t) => ({
          id: t._id,
          name: t.name,
          price: t.price,
          remaining: t.remaining,
          soldOut: t.remaining <= 0,
        })),
      },
    });
  } catch (err) {
    console.error('Get event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.myEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }).sort({ createdAt: -1 }); // newest first
 
    const items = events.map((e) => ({
      id: e._id,
      title: e.title,
      description: e.description,
      posterUrl: e.posterUrl,
      city: e.city,
      venue: e.venue,
      date: e.date,
      endDate: e.endDate,
      status: e.status,                       // upcoming / live / ended
      approvalStatus: e.approvalStatus,       // pending / approved / rejected
      rejectionReason: e.rejectionReason,     // why it was rejected (if it was)
      totalSold: e.tiers.reduce((sum, t) => sum + t.sold, 0),
      totalCapacity: e.tiers.reduce((sum, t) => sum + t.capacity, 0),
      // The owner sees everything about each tier, so the edit form can be filled in
      tiers: e.tiers.map((t) => ({
        id: t._id,
        name: t.name,
        price: t.price,
        capacity: t.capacity,
        sold: t.sold,
      })),
    }));
 
    return res.status(200).json({ count: items.length, events: items });
  } catch (err) {
    console.error('My events error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.updateEvent = async (req, res) => {
  let newPoster = null;
 
  try {
    // 1. Find the event and check it belongs to the logged-in user
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (String(event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This is not your event' });
    }
 
    // 2. Ended events are locked. Live events have a few extra limits.
    const status = event.status;
    if (status === 'ended') {
      return res.status(400).json({ message: 'Ended events cannot be edited' });
    }
    const started = status === 'live';
 
    // 3. Something must have been sent
    const body = req.body || {};
    if (Object.keys(body).length === 0 && !req.file) {
      return res.status(400).json({ message: 'Send at least one field or a new poster to update' });
    }
 
    // 4. Simple text fields
    for (const field of ['title', 'description', 'city', 'venue']) {
      if (body[field] !== undefined) event[field] = body[field];
    }
 
    // 5. Dates (Joi makes sure start and end arrive together)
    if (body.date) {
      if (started) {
        return res.status(400).json({ message: 'Dates cannot be changed once the event has started' });
      }
      event.date = body.date;
      event.endDate = body.endDate;
    }
 
    // 6. Tiers. "body.tiers" is the FULL list: with an _id = existing tier,
    //    without an _id = new tier, an existing tier that is missing = removed.
    if (body.tiers) {
      const keepIds = body.tiers.filter((t) => t._id).map((t) => String(t._id));
 
      // 6a. Removed tiers: only if nothing was sold and the event has not started
      const removed = event.tiers.filter((t) => !keepIds.includes(String(t._id)));
      for (const t of removed) {
        if (t.sold > 0 || started) {
          return res.status(409).json({
            message: `Tier "${t.name}" cannot be removed (${started ? 'the event has started' : 'tickets are already sold'})`,
          });
        }
      }
      removed.forEach((t) => event.tiers.pull(t._id));
 
      // 6b. New and changed tiers
      for (const incoming of body.tiers) {
        if (!incoming._id) {
          event.tiers.push({ name: incoming.name, price: incoming.price, capacity: incoming.capacity }); // sold starts at 0
          continue;
        }
 
        const tier = event.tiers.id(incoming._id);
        if (!tier) {
          return res.status(400).json({ message: 'One of the tiers does not belong to this event' });
        }
        if (incoming.name !== tier.name && (tier.sold > 0 || started)) {
          return res.status(409).json({ message: `Tier "${tier.name}" cannot be renamed (it has sales or the event has started)` });
        }
        if (incoming.capacity < tier.sold) {
          return res.status(409).json({ message: `Capacity of "${tier.name}" cannot go below the ${tier.sold} tickets already sold` });
        }
 
        // Only name, price and capacity are touched. "sold" is never written here.
        tier.name = incoming.name;
        tier.price = incoming.price;
        tier.capacity = incoming.capacity;
      }
    }
 
    // 7. New poster (all checks passed, so it is safe to upload now)
    const oldPublicId = event.posterPublicId;
    if (req.file) {
      try {
        const result = await uploadImage(req.file.buffer);
        newPoster = { posterUrl: result.secure_url, posterPublicId: result.public_id };
      } catch (uploadErr) {
        console.error('Poster upload error:', uploadErr);
        return res.status(502).json({ message: 'Could not upload the poster. Please try again.' });
      }
      event.posterUrl = newPoster.posterUrl;
      event.posterPublicId = newPoster.posterPublicId;
    }
 
    // 8. Editing a rejected event sends it back to the admin for another review
    if (event.approvalStatus === 'rejected') {
      event.approvalStatus = 'pending';
      event.rejectionReason = undefined;
    }
 
    await event.save();
 
    // The old poster is only removed after the save worked
    if (newPoster) await deleteImage(oldPublicId);
 
    return res.status(200).json({ message: 'Event updated', event });
  } catch (err) {
    // Save failed after a new poster was uploaded: remove that new image
    if (newPoster) await deleteImage(newPoster.posterPublicId);
 
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Update event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
 
// ---------------------------------------------------------------------------
// DELETE /events/:id   (owner only)
// ---------------------------------------------------------------------------
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (String(event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This is not your event' });
    }
 
    // Tickets were sold: refuse, so people who paid are not left with nothing.
    // (tier.sold counts the tickets that are not cancelled)
    if (event.tiers.some((t) => t.sold > 0)) {
      return res.status(409).json({ message: 'This event has sold tickets, so it cannot be deleted' });
    }
 
    await event.deleteOne();
    await deleteImage(event.posterPublicId); // remove the poster from Cloudinary too
 
    return res.status(200).json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Delete event error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};