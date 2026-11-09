const sql = require('mssql');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 15000
  }
};

async function inspectSchema() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connected to SQL Server successfully.');

    // 1. Tables list
    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    const tables = tablesRes.recordset.map(r => r.TABLE_NAME);
    console.log('\n--- TABLES IN DATABASE ---');
    console.log(tables);

    // 2. For each table, get columns and row counts
    const fullSchema = {};
    for (const t of tables) {
      const countRes = await pool.request().query(`SELECT COUNT(*) AS total FROM [${t}]`);
      const rowCount = countRes.recordset[0].total;

      const colsRes = await pool.request().query(`
        SELECT 
          COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, 
          IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${t}'
        ORDER BY ORDINAL_POSITION
      `);

      fullSchema[t] = {
        rowCount,
        columns: colsRes.recordset
      };
    }

    // 3. Primary Keys & Foreign Keys
    const pksRes = await pool.request().query(`
      SELECT 
        tc.TABLE_NAME, ccu.COLUMN_NAME, tc.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
        ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY tc.TABLE_NAME
    `);

    const fksRes = await pool.request().query(`
      SELECT 
        tp.name AS ParentTable,
        cp.name AS ParentColumn,
        tr.name AS ReferencedTable,
        cr.name AS ReferencedColumn,
        fk.name AS ConstraintName
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      ORDER BY tp.name
    `);

    const output = {
      tables,
      schema: fullSchema,
      primaryKeys: pksRes.recordset,
      foreignKeys: fksRes.recordset
    };

    require('fs').writeFileSync('scripts/db_full_schema.json', JSON.stringify(output, null, 2), 'utf8');
    console.log('\nSchema exported to scripts/db_full_schema.json successfully.');
  } catch (err) {
    console.error('Error inspecting schema:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

inspectSchema();

