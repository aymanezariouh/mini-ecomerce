SELECT
    id,
    name,
    priceCents,
    available
FROM products
WHERE available = 1;

SELECT
    id,
    customerId,
    totalCents,
    status,
    createdAt
FROM orders
WHERE customerId = 2;
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
WHERE o.id = 1;

SELECT
    o.id AS orderId,
    SUM(oi.quantity * oi.unitPriceCents) AS calculatedTotalCents
FROM orders AS o
JOIN order_items AS oi
    ON o.id = oi.orderId
WHERE o.id = 1
GROUP BY o.id;