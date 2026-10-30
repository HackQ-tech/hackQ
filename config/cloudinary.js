const cloudinary = require('cloudinary').v2;
const configured = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (configured()) cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

exports.uploadBuffer = (buffer, folder) => new Promise((resolve, reject) => {
  if (!configured()) return reject(Object.assign(new Error('Image uploads are not configured on the server (Cloudinary keys missing).'), { status: 500 }));
  const stream = cloudinary.uploader.upload_stream({ folder: `hackq/${folder}`, resource_type: 'image' },
    (err, r) => err ? reject(err) : resolve({ url: r.secure_url, publicId: r.public_id }));
  stream.end(buffer);
});
exports.destroy = (publicId) => configured() && publicId ? cloudinary.uploader.destroy(publicId).catch(() => {}) : null;
