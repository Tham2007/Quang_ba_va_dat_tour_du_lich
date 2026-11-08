const sql = require('mssql');

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

const DDL_STATEMENTS = [
  // 1. users
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
   CREATE TABLE users (
     id NVARCHAR(64) PRIMARY KEY,
     full_name NVARCHAR(255) NOT NULL,
     email NVARCHAR(255) NOT NULL UNIQUE,
     phone NVARCHAR(50) NOT NULL UNIQUE,
     password_hash NVARCHAR(500) NOT NULL,
     role NVARCHAR(50) DEFAULT 'CUSTOMER',
     active BIT DEFAULT 1,
     avatar NVARCHAR(MAX) NULL,
     created_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127),
     updated_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127)
   );`,

  // 2. sessions
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
   CREATE TABLE sessions (
     token_hash NVARCHAR(128) PRIMARY KEY,
     user_id NVARCHAR(64) NOT NULL,
     csrf_hash NVARCHAR(128) NOT NULL,
     expires_at NVARCHAR(50) NOT NULL,
     created_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127)
   );`,

  // 3. tours
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tours')
   CREATE TABLE tours (
     id NVARCHAR(64) PRIMARY KEY,
     slug NVARCHAR(255) NOT NULL UNIQUE,
     title NVARCHAR(500) NOT NULL,
     region NVARCHAR(100) NOT NULL,
     duration NVARCHAR(50) NOT NULL,
     price BIGINT NOT NULL,
     original_price BIGINT NOT NULL,
     images NVARCHAR(MAX) NOT NULL,
     departure NVARCHAR(255) NOT NULL,
     transport NVARCHAR(255) NOT NULL,
     flash_sale BIT DEFAULT 0,
     description NVARCHAR(MAX) DEFAULT '',
     itinerary_json NVARCHAR(MAX) DEFAULT '[]',
     updated_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127),
     active BIT DEFAULT 1
   );`,

  // 4. schedules
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schedules')
   CREATE TABLE schedules (
     id NVARCHAR(64) PRIMARY KEY,
     tour_id NVARCHAR(64) NOT NULL,
     departure_at NVARCHAR(50) NOT NULL,
     total_seats INT NOT NULL,
     reserved_seats INT DEFAULT 0,
     active BIT DEFAULT 1
   );`,

  // 5. itinerary_items
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'itinerary_items')
   CREATE TABLE itinerary_items (
     id INT IDENTITY(1,1) PRIMARY KEY,
     tour_id NVARCHAR(64) NOT NULL,
     day_number INT NOT NULL,
     sequence INT NOT NULL,
     category NVARCHAR(50) NOT NULL,
     title NVARCHAR(255) NOT NULL,
     description NVARCHAR(MAX) DEFAULT '',
     location NVARCHAR(255) DEFAULT '',
     start_time NVARCHAR(20) NULL
   );`,

  // 6. bookings
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bookings')
   CREATE TABLE bookings (
     id NVARCHAR(64) PRIMARY KEY,
     reference NVARCHAR(100) NOT NULL UNIQUE,
     user_id NVARCHAR(64) NOT NULL,
     schedule_id NVARCHAR(64) NOT NULL,
     idempotency_key NVARCHAR(255) NULL,
     payload_fingerprint NVARCHAR(255) NULL,
     tour_title NVARCHAR(500) NOT NULL,
     customer_name NVARCHAR(255) NOT NULL,
     customer_phone NVARCHAR(50) NOT NULL,
     customer_email NVARCHAR(255) NOT NULL,
     note NVARCHAR(MAX) DEFAULT '',
     adults INT NOT NULL,
     children INT NOT NULL,
     infants INT NOT NULL,
     seats_held INT NOT NULL,
     unit_price BIGINT NOT NULL,
     total_price BIGINT NOT NULL,
     status NVARCHAR(50) DEFAULT 'PENDING_PAYMENT',
     expires_at NVARCHAR(50) NOT NULL,
     created_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127),
     payment_evidence NVARCHAR(MAX) NULL,
     payment_confirmed_at NVARCHAR(50) NULL,
     updated_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127)
   );`,

  // 7. audit_log
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_log')
   CREATE TABLE audit_log (
     id NVARCHAR(64) PRIMARY KEY,
     actor_id NVARCHAR(64) NOT NULL,
     event_type NVARCHAR(100) NOT NULL,
     subject_id NVARCHAR(64) NULL,
     details_json NVARCHAR(MAX) DEFAULT '{}',
     created_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127)
   );`,

  // 8. favorites
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'favorites')
   CREATE TABLE favorites (
     user_id NVARCHAR(64) NOT NULL,
     tour_id NVARCHAR(64) NOT NULL,
     created_at NVARCHAR(50) DEFAULT CONVERT(NVARCHAR(50), GETUTCDATE(), 127),
     PRIMARY KEY (user_id, tour_id)
   );`
];

async function setupTables() {
  console.log('Connecting to SQL Server at sql8020.site4now.net...');
  const pool = await sql.connect(config);
  console.log('Connected successfully!');

  for (const ddl of DDL_STATEMENTS) {
    await pool.request().query(ddl);
  }
  console.log('Created missing tables in SQL Server: users, sessions, tours, schedules, itinerary_items, bookings, audit_log, favorites.');

  // List all tables now
  const res = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
  console.log('All tables in db_ad0b71_dattour:', res.recordset.map(r => r.TABLE_NAME));

  await pool.close();
}

setupTables().catch(err => {
  console.error('Lỗi thiết lập bảng trên SQL Server:', err);
  process.exit(1);
});

