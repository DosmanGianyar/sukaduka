const db = require('../server/db');
const members = db.prepare("SELECT id, member_no, name, status FROM members ORDER BY CASE WHEN status = 'PENSIUN' THEN 1 ELSE 0 END ASC, member_no ASC, id ASC").all();

console.log('--- 5 Anggota Pertama (Aktif) ---');
members.slice(0, 5).forEach(m => console.log(`${m.member_no}. ${m.name} [${m.status}]`));

console.log('\n--- 5 Anggota Terakhir (Pensiun di Bawah) ---');
members.slice(-5).forEach(m => console.log(`${m.member_no}. ${m.name} [${m.status}]`));
