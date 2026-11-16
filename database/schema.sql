-- Reference schema. api/index.php runs this automatically on first request (SQLite).
-- For MySQL replace INTEGER PRIMARY KEY AUTOINCREMENT with INT AUTO_INCREMENT PRIMARY KEY.
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT, cat TEXT, price REAL, cov REAL, spaces TEXT, moods TEXT, descr TEXT);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, address TEXT, notes TEXT, items TEXT, total REAL, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quotes(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, space TEXT, size REAL, mood TEXT, location TEXT, install INTEGER, estimate REAL, details TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, message TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
