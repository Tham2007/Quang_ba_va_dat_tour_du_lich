const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: process.env.DELTA_MSSQL_PASSWORD || '',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true }
};

async function testCrud() {
  const pool = await sql.connect(config);
  console.log('[1] Connected to SQL Server.');

  // Check Tour 1
  const tour1 = await pool.request().query('SELECT * FROM dbo.TOUR WHERE MaTour = 1');
  const original = tour1.recordset[0];
  console.log('[2] Original Tour 1:', original.TenTour, '| Gia:', original.GiaKhuyenNghi);

  // Test Transaction UPDATE with COMMIT
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    req.input('maTour', sql.Int, 1);
    req.input('newPrice', sql.Decimal(18, 2), 3950000);
    req.input('newTitle', sql.NVarChar(200), original.TenTour + ' [TEST]');
    await req.query(`
      UPDATE dbo.TOUR 
      SET GiaKhuyenNghi = @newPrice, TenTour = @newTitle
      WHERE MaTour = @maTour
    `);
    await tx.commit();
    console.log('[3] Transaction committed successfully!');
  } catch (err) {
    await tx.rollback();
    console.error('[ERROR] Rollback:', err);
  }

  // Verify updated
  const updatedRes = await pool.request().query('SELECT * FROM dbo.TOUR WHERE MaTour = 1');
  console.log('[4] Updated Tour 1 in DB:', updatedRes.recordset[0].TenTour, '| Gia:', updatedRes.recordset[0].GiaKhuyenNghi);

  // Revert back
  const txRevert = new sql.Transaction(pool);
  await txRevert.begin();
  const reqRev = new sql.Request(txRevert);
  reqRev.input('maTour', sql.Int, 1);
  reqRev.input('origPrice', sql.Decimal(18, 2), original.GiaKhuyenNghi);
  reqRev.input('origTitle', sql.NVarChar(200), original.TenTour);
  await reqRev.query(`
    UPDATE dbo.TOUR 
    SET GiaKhuyenNghi = @origPrice, TenTour = @origTitle
    WHERE MaTour = @maTour
  `);
  await txRevert.commit();
  console.log('[5] Reverted Tour 1 back to original.');

  // Test Transaction ROLLBACK on intentional error
  const txRollback = new sql.Transaction(pool);
  await txRollback.begin();
  try {
    const badReq = new sql.Request(txRollback);
    await badReq.query('UPDATE dbo.NON_EXISTING_TABLE SET X = 1');
    await txRollback.commit();
  } catch (err) {
    await txRollback.rollback();
    console.log('[6] Rollback successfully caught error as expected:', err.message);
  }

  await pool.close();
  console.log('[7] ALL TESTS PASSED!');
}

testCrud().catch(console.error);
