const QRCode = require('qrcode');

// Turns text (the ticket code) into a QR image as a "data URL":
// a string like "data:image/png;base64,iVBOR..." that works directly in <img src="...">
exports.makeQR = (text) => QRCode.toDataURL(text, { margin: 1, width: 300 });