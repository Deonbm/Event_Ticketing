const Joi = require('joi');

const DAY = 24 * 60 * 60 * 1000;

const title = Joi.string().trim().min(3).max(100);
const description = Joi.string().trim().max(2000).allow('');
const posterUrl = Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(500).allow('')
  .messages({ 'string.uri': 'Poster must be a valid http or https link' });
const city = Joi.string().trim().min(2).max(60);
const venue = Joi.string().trim().min(2).max(100);

const startDate = Joi.date()
  .iso()
  .greater('now')
  .custom((value, helpers) =>
    value.getTime() > Date.now() + 365 * DAY
      ? helpers.message('Start date must be within the next year')
      : value
  )
  .messages({
    'date.base': 'Start date is not a valid date',
    'date.format': 'Start date is not a valid date',
    'date.greater': 'Start date must be in the future',
    'any.required': 'Start date is required',
  });

const endDate = Joi.date()
  .iso()
  .greater(Joi.ref('date'))
  .custom((value, helpers) => {
    const start = new Date(helpers.state.ancestors[0].date);

    return value.getTime() - start.getTime() > 30 * DAY
      ? helpers.message('An event cannot last longer than 30 days')
      : value;
  })
  .messages({
    'date.base': 'End date is not a valid date',
    'date.format': 'End date is not a valid date',
    'date.greater': 'End date must be after the start date',
    'any.required': 'End date is required',
    'any.ref': 'Send the start date and end date together',
  });

// ---------- tiers ----------
const tierFields = {
  name: Joi.string().trim().min(1).max(30).required(),
  price: Joi.number().min(0).max(100000).required(),            // 0 = free tier
  capacity: Joi.number().integer().min(1).max(10000).required(),
};
const createTier = Joi.object(tierFields);                                     // "sold" is stripped
const updateTier = Joi.object({ _id: Joi.string().hex().length(24), ...tierFields }); // _id = existing tier

// Tier names must be unique inside one event (ignoring upper/lower case)
const uniqueTierNames = (tiers, helpers) => {
  const names = tiers.map((t) => t.name.trim().toLowerCase());
  return new Set(names).size !== names.length
    ? helpers.message('Tier names must be unique within an event')
    : tiers;
};

// ---------- schemas ----------

// POST /events
const createEventSchema = Joi.object({
  title: Joi.string().trim().min(3).max(100).required(),

  description: Joi.string().trim().max(2000).allow(''),

  venue: Joi.string().trim().min(2).max(100).allow(''),

  city: Joi.string().trim().min(2).max(60).allow(''),

  date: startDate.required(),

  endDate: endDate.required(),

  tiers: Joi.array()
    .items(createTier)
    .min(1)
    .max(6)
    .custom(uniqueTierNames)
    .required()
});

// PUT /events/:id  (every field optional, but at least one must be sent)
// Dates must be sent together. If "tiers" is sent, it is the FULL list:
// tiers with an _id are existing ones, tiers without are new, missing ones are removals.
// The controller applies the "not below sold" and "no rename if sold" rules.
const updateEventSchema = Joi.object({
  title,
  description,
  city,
  venue,
  date: startDate,
  endDate,
  tiers: Joi.array().items(updateTier).min(1).max(6).custom(uniqueTierNames),
})
  .and('date', 'endDate')
  .messages({
    'object.and': 'Send the start date and end date together',
  });

// GET /events?city=&q=&status=&page=&limit=
const listEventsQuerySchema = Joi.object({
  city: Joi.string().trim().max(60),
  q: Joi.string().trim().max(100),
  status: Joi.string().valid('upcoming', 'live', 'ended'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(12),
});

// /events/:id (also works for admin routes with :id)
const idParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid id',
    'string.hex': 'Invalid id',
  }),
});

// Admin rejects an event: a reason is required
const rejectEventSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(300).required(),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  idParamSchema,
  rejectEventSchema,
};