const multer = require('multer');
const { httpError } = require('../utils/helpers');
const MAX_MB = 6;

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype) ? cb(null, true) : cb(httpError(400, 'Only JPG, PNG, GIF or WEBP images are allowed'))
});
