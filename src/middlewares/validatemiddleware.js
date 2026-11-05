
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source] || {}, {
    abortEarly: false,   
    stripUnknown: true,  
    errors: { wrap: { label: false } },  
  });

  if (error) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    });
  }

  if (source === 'body') {
    req.body = value;
  } else {
     
    req.validated = req.validated || {};
    req.validated[source] = value;
  }
  next();
};