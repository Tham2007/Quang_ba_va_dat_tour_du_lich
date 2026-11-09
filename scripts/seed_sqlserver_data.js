const sql = require('mssql');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const config = {
  user: 'db_ad0b71_dattour_admin',
  password: 'Phamtham312007@',
  server: 'sql8020.site4now.net',
  port: 1433,
  database: 'db_ad0b71_dattour',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function seedData() {
  const localDb = new DatabaseSync(path.resolve(__dirname, '../API/delta_dev.db'));
  const pool = await sql.connect(config);

  console.log('Synchronizing users from SQLite to SQL Server...');
  const users = localDb.prepare('SELECT * FROM users').all();
  for (const u of users) {
    const existing = await pool.request()
      .input('id', sql.NVarChar(64), u.id)
      .query('SELECT id FROM users WHERE id = @id');
    if (existing.recordset.length === 0) {
      await pool.request()
        .input('id', sql.NVarChar(64), u.id)
        .input('full_name', sql.NVarChar(255), u.full_name)
        .input('email', sql.NVarChar(255), u.email)
        .input('phone', sql.NVarChar(50), u.phone)
        .input('password_hash', sql.NVarChar(500), u.password_hash)
        .input('role', sql.NVarChar(50), u.role || 'CUSTOMER')
        .input('active', sql.Bit, u.active ? 1 : 0)
        .input('avatar', sql.NVarChar(sql.MAX), u.avatar || null)
        .input('created_at', sql.NVarChar(50), u.created_at || new Date().toISOString())
        .input('updated_at', sql.NVarChar(50), u.updated_at || new Date().toISOString())
        .query(`
          INSERT INTO users (id, full_name, email, phone, password_hash, role, active, avatar, created_at, updated_at)
          VALUES (@id, @full_name, @email, @phone, @password_hash, @role, @active, @avatar, @created_at, @updated_at)
        `);
    }
  }

  console.log('Synchronizing 16 tours to SQL Server...');
  const tours = localDb.prepare('SELECT * FROM tours').all();
  for (const t of tours) {
    const existing = await pool.request()
      .input('id', sql.NVarChar(64), t.id)
      .query('SELECT id FROM tours WHERE id = @id');
    if (existing.recordset.length === 0) {
      await pool.request()
        .input('id', sql.NVarChar(64), t.id)
        .input('slug', sql.NVarChar(255), t.slug)
        .input('title', sql.NVarChar(500), t.title)
        .input('region', sql.NVarChar(100), t.region)
        .input('duration', sql.NVarChar(50), t.duration)
        .input('price', sql.BigInt, t.price)
        .input('original_price', sql.BigInt, t.original_price)
        .input('images', sql.NVarChar(sql.MAX), t.image || t.images || 'assets/images/halong.png')
        .input('departure', sql.NVarChar(255), t.departure)
        .input('transport', sql.NVarChar(255), t.transport)
        .input('flash_sale', sql.Bit, t.flash_sale ? 1 : 0)
        .input('description', sql.NVarChar(sql.MAX), t.description || '')
        .input('itinerary_json', sql.NVarChar(sql.MAX), t.itinerary_json || '[]')
        .input('updated_at', sql.NVarChar(50), t.updated_at || new Date().toISOString())
        .input('active', sql.Bit, t.active ? 1 : 0)
        .query(`
          INSERT INTO tours (id, slug, title, region, duration, price, original_price, images, departure, transport, flash_sale, description, itinerary_json, updated_at, active)
          VALUES (@id, @slug, @title, @region, @duration, @price, @original_price, @images, @departure, @transport, @flash_sale, @description, @itinerary_json, @updated_at, @active)
        `);
    }
  }

  console.log('Synchronizing schedules to SQL Server...');
  const schedules = localDb.prepare('SELECT * FROM schedules').all();
  for (const s of schedules) {
    const existing = await pool.request()
      .input('id', sql.NVarChar(64), s.id)
      .query('SELECT id FROM schedules WHERE id = @id');
    if (existing.recordset.length === 0) {
      await pool.request()
        .input('id', sql.NVarChar(64), s.id)
        .input('tour_id', sql.NVarChar(64), s.tour_id)
        .input('departure_at', sql.NVarChar(50), s.departure_at)
        .input('total_seats', sql.Int, s.total_seats)
        .input('reserved_seats', sql.Int, s.reserved_seats || 0)
        .input('active', sql.Bit, s.active ? 1 : 0)
        .query(`
          INSERT INTO schedules (id, tour_id, departure_at, total_seats, reserved_seats, active)
          VALUES (@id, @tour_id, @departure_at, @total_seats, @reserved_seats, @active)
        `);
    }
  }

  console.log('Synchronizing itinerary items to SQL Server...');
  const items = localDb.prepare('SELECT * FROM itinerary_items').all();
  for (const it of items) {
    await pool.request()
      .input('tour_id', sql.NVarChar(64), it.tour_id)
      .input('day_number', sql.Int, it.day_number)
      .input('sequence', sql.Int, it.sequence)
      .input('category', sql.NVarChar(50), it.category)
      .input('title', sql.NVarChar(255), it.title)
      .input('description', sql.NVarChar(sql.MAX), it.description || '')
      .input('location', sql.NVarChar(255), it.location || '')
      .input('start_time', sql.NVarChar(20), it.start_time || null)
      .query(`
        IF NOT EXISTS (SELECT id FROM itinerary_items WHERE tour_id = @tour_id AND day_number = @day_number AND sequence = @sequence)
        INSERT INTO itinerary_items (tour_id, day_number, sequence, category, title, description, location, start_time)
        VALUES (@tour_id, @day_number, @sequence, @category, @title, @description, @location, @start_time)
      `);
  }

  // Count check
  const tourCount = await pool.request().query('SELECT COUNT(*) AS c FROM tours');
  const userCount = await pool.request().query('SELECT COUNT(*) AS c FROM users');
  const schedCount = await pool.request().query('SELECT COUNT(*) AS c FROM schedules');
  const itCount = await pool.request().query('SELECT COUNT(*) AS c FROM itinerary_items');

  console.log('=== KẾT QUẢ ĐỒNG BỘ DỮ LIỆU SQL SERVER ===');
  console.log(`- Tours: ${tourCount.recordset[0].c} bản ghi`);
  console.log(`- Users: ${userCount.recordset[0].c} bản ghi`);
  console.log(`- Schedules: ${schedCount.recordset[0].c} bản ghi`);
  console.log(`- Itinerary Items: ${itCount.recordset[0].c} bản ghi`);

  await pool.close();
}

seedData().catch(err => {
  console.error('Lỗi seed data lên SQL Server:', err);
  process.exit(1);
});
