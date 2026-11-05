const Joi = require('joi');

const bookTicketSchema = Joi.object({
  
  tierName: Joi.string().trim().min(1).max(30).required().messages({
    'any.required': 'Ticket tier is required',
    'string.empty': 'Ticket tier is required',
  }),
  quantity: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'Book at least 1 ticket',
    'number.max': 'You can book at most 5 tickets at a time',
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be a whole number',
    'any.required': 'Quantity is required',
  }),
});

const verifyTicketSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(6).max(30).required().messages({
    'any.required': 'Ticket code is required',
    'string.empty': 'Ticket code is required',
  }),
});

module.exports = { bookTicketSchema, verifyTicketSchema };