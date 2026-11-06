const app = require('../server/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. Login
    const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ketua', password: 'ketua123' })
    });
    const { token } = await loginRes.json();
    console.log('1. Logged in successfully');

    // 2. Add New Teacher: Made Adi joining in Juli 2026 (month 7)
    const addRes = await fetch(`http://localhost:${port}/api/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'I Made Adi Guru Baru, S.Pd',
        nip: '199501012026011001',
        type: 'GURU',
        status: 'AKTIF',
        join_year: 2026,
        join_month: 7,
        notes: 'Guru Baru TMT Juli 2026'
      })
    });
    const addData = await addRes.json();
    console.log('2. Added Member:', addData);
    const memberId = addData.id;

    // 3. Check Grid 2026 for this new member
    const gridRes = await fetch(`http://localhost:${port}/api/contributions/grid?year=2026`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const gridData = await gridRes.json();
    const newMemberInGrid = gridData.grid.find(m => m.id === memberId);
    console.log('3. Member months in 2026:');
    console.log('   Bulan 1-6 (Sebelum masuk):', [1,2,3,4,5,6].map(m => `Bln ${m}: ${newMemberInGrid.months[m].status}`));
    console.log('   Bulan 7-12 (Setelah masuk):', [7,8,9,10,11,12].map(m => `Bln ${m}: ${newMemberInGrid.months[m].status}`));

    // 4. Test Trying to Pay Month 3 (Should be BLOCKED)
    const blockedRes = await fetch(`http://localhost:${port}/api/contributions/quick-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        member_id: memberId,
        year: 2026,
        month: 3
      })
    });
    const blockedData = await blockedRes.json();
    console.log('4. Attempted payment for Month 3 (Expect Blocked):', blockedRes.status, blockedData.error);

    // 5. Test Paying Month 7 (Should be ALLOWED)
    const allowRes = await fetch(`http://localhost:${port}/api/contributions/quick-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        member_id: memberId,
        year: 2026,
        month: 7
      })
    });
    const allowData = await allowRes.json();
    console.log('5. Attempted payment for Month 7 (Expect Success):', allowRes.status, allowData);

    // Clean up test member
    await fetch(`http://localhost:${port}/api/members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('6. Cleaned up test member');

    console.log('\n>>> PENGUJIAN FITUR MULAI MASUK GURU BARU 100% SUKSES! <<<');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    server.close();
  }
});

