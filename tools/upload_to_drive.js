// tools/upload_to_drive.js
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const MASTER = path.join(process.cwd(), 'out', 'master', 'master.json');
const KEY_FILE = process.env.GDRIVE_KEY_FILE || './service-account.json'; // JSON del SA
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || ''; // Carpeta de Drive compartida con el SA

if (!fs.existsSync(MASTER)) { console.error('No existe master.json'); process.exit(1); }
if (!fs.existsSync(KEY_FILE)) { console.error('No existe service-account.json'); process.exit(1); }
if (!FOLDER_ID) { console.error('Setea GDRIVE_FOLDER_ID'); process.exit(1); }

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

(async ()=>{
  const name = `master_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  const fileMetadata = { name, parents: [FOLDER_ID] };
  const media = { mimeType: 'application/json', body: fs.createReadStream(MASTER) };
  const res = await drive.files.create({ requestBody: fileMetadata, media, fields: 'id,webViewLink' });
  console.log('Subido a Drive:', res.data);
})();
