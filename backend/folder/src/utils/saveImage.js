const fs = require('fs');
const path = require('path');

function saveBase64Image(base64String) {
  if (!base64String) return null;

  const matches = base64String.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return null;

  const ext = matches[1].split('/')[1] || 'png';
  const data = matches[2];

  const uploadDir = path.join(__dirname, '../uploads');

  // ensure folder exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 🔥 FIXED FILE NAME (NO DUPLICATES)
  const fileName = `logo.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

  return `/uploads/${fileName}`;
}

module.exports = saveBase64Image;