const app = require('../server/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. Test /health
    const healthRes = await fetch(`http://localhost:${port}/health`);
    const healthData = await healthRes.json();
    console.log('1. Health Check:', healthData);

    // 2. Test Login
    const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ketua', password: 'ketua123' })
    });
    const loginData = await loginRes.json();
    console.log('2. Login as Ketua:', loginData.user);
    const token = loginData.token;

    // 3. Test Summary
    const summaryRes = await fetch(`http://localhost:${port}/api/summary?year=2026`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const summaryData = await summaryRes.json();
    console.log('3. Summary Grand Totals:', summaryData.grandTotals);

    // 4. Test Grid
    const gridRes = await fetch(`http://localhost:${port}/api/contributions/grid?year=2026`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const gridData = await gridRes.json();
    console.log(`4. Grid 2026: ${gridData.totalMembers} members, Grand Total: Rp ${gridData.grandTotal}`);

    // 5. Test Landscape Report Data
    const reportRes = await fetch(`http://localhost:${port}/api/reports/landscape-data?year=2026`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const reportData = await reportRes.json();
    console.log('5. Landscape Report Signatures:', {
      Ketua: reportData.settings.leader_name,
      Bendahara: reportData.settings.treasurer_name,
      Sekretaris: reportData.settings.secretary_name
    });
    console.log('   Saldo Kas Akhir:', reportData.saldoAkhir);

    console.log('\n>>> SEMUA PENGUJIAN API BERHASIL! <<<');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    server.close();
  }
});

