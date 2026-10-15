INSERT INTO categories (name, slug, sort_order) VALUES
  ('Đồ gia dụng', 'do-gia-dung', 1),
  ('Nội thất', 'noi-that', 2),
  ('Nhà bếp', 'nha-bep', 3),
  ('Trang trí', 'trang-tri', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Điện gia dụng', 'dien-gia-dung', (SELECT id FROM categories WHERE slug = 'do-gia-dung'), 1),
  ('Dọn dẹp', 'don-dep', (SELECT id FROM categories WHERE slug = 'do-gia-dung'), 2),
  ('Bàn ghế', 'ban-ghe', (SELECT id FROM categories WHERE slug = 'noi-that'), 1),
  ('Tủ kệ', 'tu-ke', (SELECT id FROM categories WHERE slug = 'noi-that'), 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (category_id, name, slug, description, price, stock) VALUES
  ((SELECT id FROM categories WHERE slug = 'dien-gia-dung'), 'Nồi chiên không dầu 5L', 'noi-chien-khong-dau-5l', 'Dung tích 5 lít, nhiều chế độ nấu.', 1290000, 25),
  ((SELECT id FROM categories WHERE slug = 'dien-gia-dung'), 'Máy hút bụi cầm tay', 'may-hut-bui-cam-tay', 'Nhỏ gọn, dùng pin sạc.', 890000, 18),
  ((SELECT id FROM categories WHERE slug = 'don-dep'), 'Bộ chổi và hốt rác', 'bo-choi-va-hot-rac', 'Cán dài, dễ cất gọn.', 99000, 60),
  ((SELECT id FROM categories WHERE slug = 'ban-ghe'), 'Bàn làm việc gỗ 120cm', 'ban-lam-viec-go-120cm', 'Mặt bàn gỗ công nghiệp, chân sắt chắc chắn.', 1490000, 10),
  ((SELECT id FROM categories WHERE slug = 'ban-ghe'), 'Ghế gỗ bọc nệm', 'ghe-go-boc-nem', 'Đệm êm, dễ vệ sinh.', 590000, 30),
  ((SELECT id FROM categories WHERE slug = 'tu-ke'), 'Kệ sách 5 tầng', 'ke-sach-5-tang', 'Khung chắc, lắp ráp đơn giản.', 1190000, 12),
  ((SELECT id FROM categories WHERE slug = 'nha-bep'), 'Bộ nồi inox 3 món', 'bo-noi-inox-3-mon', 'Đáy dày, dùng được trên nhiều loại bếp.', 790000, 20),
  ((SELECT id FROM categories WHERE slug = 'trang-tri'), 'Đèn bàn LED', 'den-ban-led', 'Ba mức sáng, tiết kiệm điện.', 249000, 40),
  ((SELECT id FROM categories WHERE slug = 'trang-tri'), 'Khung ảnh treo tường', 'khung-anh-treo-tuong', 'Khung gỗ, nhiều kích cỡ.', 129000, 50)
ON CONFLICT (slug) DO NOTHING;