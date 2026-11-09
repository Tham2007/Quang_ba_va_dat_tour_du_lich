const sql = require('mssql');
const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function enforceExactSchema() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL Server.');

  // 1. Drop index UX_TOUR_Slug if exists
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_TOUR_Slug' AND object_id = OBJECT_ID('dbo.TOUR'))
      BEGIN
        DROP INDEX UX_TOUR_Slug ON dbo.TOUR;
        PRINT 'Dropped index UX_TOUR_Slug';
      END
    `);
  } catch (err) {
    console.error('Error dropping UX_TOUR_Slug:', err.message);
  }

  // 2. Drop default constraint DF_NGUOIDUNG_VaiTro
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_NGUOIDUNG_VaiTro')
      BEGIN
        ALTER TABLE dbo.NGUOIDUNG DROP CONSTRAINT DF_NGUOIDUNG_VaiTro;
        PRINT 'Dropped DF_NGUOIDUNG_VaiTro';
      END
    `);
  } catch (err) {
    console.error('Error dropping DF_NGUOIDUNG_VaiTro:', err.message);
  }

  // 3. Drop default constraint DF_TOUR_FlashSale
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_TOUR_FlashSale')
      BEGIN
        ALTER TABLE dbo.TOUR DROP CONSTRAINT DF_TOUR_FlashSale;
        PRINT 'Dropped DF_TOUR_FlashSale';
      END
    `);
  } catch (err) {
    console.error('Error dropping DF_TOUR_FlashSale:', err.message);
  }

  // 4. Drop extra columns from NGUOIDUNG
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.NGUOIDUNG') AND name = 'VaiTro')
      BEGIN
        ALTER TABLE dbo.NGUOIDUNG DROP COLUMN VaiTro;
        PRINT 'Dropped VaiTro from NGUOIDUNG';
      END
    `);
  } catch (err) {
    console.error('Error dropping column VaiTro:', err.message);
  }

  // 5. Drop extra columns from TOUR
  const tourColsToDrop = ['Slug', 'Duration', 'Departure', 'Transport', 'GiaGoc', 'FlashSale'];
  for (const col of tourColsToDrop) {
    try {
      await pool.request().query(`
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TOUR') AND name = '${col}')
        BEGIN
          ALTER TABLE dbo.TOUR DROP COLUMN [${col}];
          PRINT 'Dropped ${col} from TOUR';
        END
      `);
    } catch (err) {
      console.error(`Error dropping ${col} from TOUR:`, err.message);
    }
  }

  // 6. Drop extra columns from LICH_TRINH_DETAIL
  const ltColsToDrop = ['ThuTuTrongNgay', 'LoaiHoatDong', 'DiaDiem', 'GioBatDau'];
  for (const col of ltColsToDrop) {
    try {
      await pool.request().query(`
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.LICH_TRINH_DETAIL') AND name = '${col}')
        BEGIN
          ALTER TABLE dbo.LICH_TRINH_DETAIL DROP COLUMN [${col}];
          PRINT 'Dropped ${col} from LICH_TRINH_DETAIL';
        END
      `);
    } catch (err) {
      console.error(`Error dropping ${col} from LICH_TRINH_DETAIL:`, err.message);
    }
  }

  // 7. Verify all columns of all 12 tables
  const colsRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  const summary = {};
  colsRes.recordset.forEach(c => {
    if (!summary[c.TABLE_NAME]) summary[c.TABLE_NAME] = [];
    summary[c.TABLE_NAME].push(`${c.COLUMN_NAME} (${c.DATA_TYPE}, nullable: ${c.IS_NULLABLE})`);
  });

  console.log('\n--- VERIFIED SCHEMA OF ALL TABLES ---');
  for (const [tbl, cols] of Object.entries(summary)) {
    console.log(`\nTable [${tbl}]:`);
    cols.forEach(c => console.log(`   - ${c}`));
  }

  await pool.close();
}

enforceExactSchema().catch(console.error);
