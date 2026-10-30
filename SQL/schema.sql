
PRAGMA foreign_keys = ON;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN ('customer', 'seller'))
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
        CHECK (length(trim(name)) > 0),
    description TEXT,
    priceCents INTEGER NOT NULL
        CHECK (priceCents > 0),
    available INTEGER NOT NULL DEFAULT 1
        CHECK (available IN (0, 1))
);

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    customerId INTEGER NOT NULL,
    totalCents INTEGER NOT NULL
        CHECK (totalCents > 0),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'processed')),
    createdAt TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customerId)
        REFERENCES users(id)
);

-- ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    productName TEXT NOT NULL,
    quantity INTEGER NOT NULL
        CHECK (quantity BETWEEN 1 AND 10),
    unitPriceCents INTEGER NOT NULL
        CHECK (unitPriceCents > 0),

    FOREIGN KEY (orderId)
        REFERENCES orders(id),

    FOREIGN KEY (productId)
        REFERENCES products(id),

    UNIQUE (orderId, productId)
);
