
PRAGMA foreign_keys = ON;

-- Les identifiants de demonstration sont fixes : relancer ce fichier
-- ne cree aucun doublon et ne modifie pas les donnees deja presentes.
BEGIN TRANSACTION;

-- 1. Create users
INSERT INTO users (id, name, email, passwordHash, role)
VALUES
  (1, 'Seller', 'seller@example.com', 'demo-not-for-login', 'seller'),
  (2, 'Customer One', 'customer1@example.com', 'demo-not-for-login', 'customer'),
  (3, 'Customer Two', 'customer2@example.com', 'demo-not-for-login', 'customer')
ON CONFLICT(id) DO NOTHING;

-- 2. Create products
INSERT INTO products (id, name, description, priceCents, available)
VALUES
  (1, 'Mouse', 'Wireless mouse', 2500, 1),
  (2, 'Keyboard', 'Mechanical keyboard', 1000, 1),
  (3, 'Headphones', 'Bluetooth headphones', 4500, 0)
ON CONFLICT(id) DO NOTHING;

-- 3. Create orders
INSERT INTO orders (id, customerId, totalCents, status, createdAt, customerNote)
VALUES
  (1, 2, 6000, 'new', '2026-01-01 10:00:00', 'Livrer apres 18 h'),
  (2, 3, 4500, 'processed', '2026-01-02 10:00:00', NULL)
ON CONFLICT(id) DO NOTHING;

-- 4. Create order items

INSERT INTO order_items (
  orderId,
  productId,
  productName,
  quantity,
  unitPriceCents
)
VALUES
  (1, 1, 'Mouse', 2, 2500),
  (1, 2, 'Keyboard', 1, 1000),
  (2, 3, 'Headphones', 1, 4500)
ON CONFLICT(orderId, productId) DO NOTHING;

COMMIT;

