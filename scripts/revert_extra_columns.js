const mssql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000
  }
};

async function dropExtraColumns() {
  const pool = await mssql.connect(config);
  console.log('Connected to SQL Server.');

  // Drop extra columns from NGUOIDUNG if present
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.NGUOIDUNG') AND name = 'TokenHash')
        ALTER TABLE dbo.NGUOIDUNG DROP COLUMN TokenHash;
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.NGUOIDUNG') AND name = 'CsrfHash')
        ALTER TABLE dbo.NGUOIDUNG DROP COLUMN CsrfHash;
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.NGUOIDUNG') AND name = 'HetHan')
        ALTER TABLE dbo.NGUOIDUNG DROP COLUMN HetHan;
    `);
    console.log('[OK] Dropped extra columns from NGUOIDUNG.');
  } catch (err) {
    console.error('Error on NGUOIDUNG:', err.message);
  }

  // Drop extra columns from TOUR if present
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TOUR') AND name = 'ChiPhiChiTiet')
        ALTER TABLE dbo.TOUR DROP COLUMN ChiPhiChiTiet;
    `);
    console.log('[OK] Dropped extra columns from TOUR.');
  } catch (err) {
    console.error('Error on TOUR:', err.message);
  }

  // Drop extra columns from DATTOUR if present
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DATTOUR') AND name = 'KhoaYeuCau')
        ALTER TABLE dbo.DATTOUR DROP COLUMN KhoaYeuCau;
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DATTOUR') AND name = 'DauVanTay')
        ALTER TABLE dbo.DATTOUR DROP COLUMN DauVanTay;
    `);
    console.log('[OK] Dropped extra columns from DATTOUR.');
  } catch (err) {
    console.error('Error on DATTOUR:', err.message);
  }

  await pool.close();
  console.log('Done reverting extra columns.');
}

dropExtraColumns().catch(console.error);

