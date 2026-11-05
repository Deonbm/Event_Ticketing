const multer = require('multer');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG or WebP images are allowed'));
  },
});

 
 
exports.uploadPoster = (req, res, next) => {
  upload.single('poster')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Poster must be 2 MB or smaller' : err.message;
      return res.status(400).json({ message });
    }
    next();
  });
};

 
exports.parseTiers = (req, res, next) => {
  if (typeof req.body.tiers === 'string') {
    try {
      req.body.tiers = JSON.parse(req.body.tiers);
    } catch (e) {
      return res.status(400).json({ message: 'tiers must be valid JSON' });
    }
  }
  next();
};