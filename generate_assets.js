const fs = require('fs');
const assetsDir = './assets';
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
// Note: For a real APK, replace icon.png with a 1024x1024 emerald green image
console.log("Assets folder prepared. Please add icon.png (1024x1024) to /assets");