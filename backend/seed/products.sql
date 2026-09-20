-- The 10 shared SKUs (plan.md Section 1 / 3.1.2). Same list is entered into both Shopify
-- stores by T-0.4/T-0.5; keep this, backend/seed/products.json (T-0.3) and the stores in
-- step. `on conflict do nothing` keeps it re-runnable.
insert into products (sku, name, price) values
  ('SKU-001', 'Aero Travel Mug',            19.99),
  ('SKU-002', 'Field Notebook A5',          12.50),
  ('SKU-003', 'Merino Crew Socks',          24.00),
  ('SKU-004', 'Canvas Tote Bag',            29.95),
  ('SKU-005', 'Ceramic Pour-Over Set',      45.00),
  ('SKU-006', 'Bamboo Desk Tray',           34.75),
  ('SKU-007', 'Wool Felt Coasters (4-pack)', 14.00),
  ('SKU-008', 'Insulated Bottle 750ml',     39.90),
  ('SKU-009', 'Linen Apron',                52.00),
  ('SKU-010', 'Brass Desk Lamp',            89.50)
on conflict (sku) do nothing;
