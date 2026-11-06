require('dotenv').config();
const app = require('./server/app');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  SISTEM INFORMASI SUKA DUKA GURU & PEGAWAI SEKOLAH    `);
  console.log(`=======================================================`);
  console.log(`  Server aktif & berjalan di:                          `);
  console.log(`  - Lokal  : http://localhost:${PORT}                 `);
  console.log(`  - Jaringan: http://${HOST}:${PORT}                  `);
  console.log(`=======================================================`);
});

