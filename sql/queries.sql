-- 1. Produits disponibles.
SELECT
    id,
    name,
    priceCents,
    available
FROM products
WHERE available = 1
ORDER BY id;

-- 2. Commandes du client 2 (le script Node utilise un parametre).
SELECT
    id,
    customerId,
    totalCents,
    status,
    createdAt,
    customerNote
FROM orders
WHERE customerId = 2
ORDER BY id;

-- 3. Detail de la commande 1 : nom actuel et nom conserve lors de l'achat.
SELECT
    o.id AS orderId,
    p.name AS currentProductName,
    oi.productName AS purchasedProductName,
    oi.quantity,
    oi.unitPriceCents,
    oi.quantity * oi.unitPriceCents AS lineTotalCents
FROM orders AS o
JOIN order_items AS oi
    ON o.id = oi.orderId
JOIN products AS p
    ON oi.productId = p.id
WHERE o.id = 1
ORDER BY oi.id;

-- 4. Total de la commande 1 calcule a partir des prix historiques.
SELECT
    o.id AS orderId,
    SUM(oi.quantity * oi.unitPriceCents) AS calculatedTotalCents
FROM orders AS o
JOIN order_items AS oi
    ON o.id = oi.orderId
WHERE o.id = 1
GROUP BY o.id;
