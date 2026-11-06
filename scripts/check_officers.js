const db = require('../server/db');
const officers = db.prepare(`
  SELECT id, member_no, name, status, nip, officer_role
  FROM members
  WHERE name LIKE '%Suwita%' OR name LIKE '%Setiawati%' OR name LIKE '%Darma Putra%'
`).all();
console.log('Officers:', officers);
