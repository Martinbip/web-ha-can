# Trình soạn tin tức: SEO, ảnh trong bài, công cụ soạn thảo, chia sẻ mạng xã hội

Ngày: 2026-10-13. Người dùng chọn làm cả bốn nhóm, và sửa ba đường dẫn sai của bài cũ kèm chuyển hướng.

## 1. SEO bài viết

- **Đường dẫn sửa được.** Bài mới: tự bám theo tiêu đề cho tới khi biên tập viên tự sửa. Bài đã có: không bám tiêu đề nữa (sửa tiêu đề không làm chết link), nhưng bấm "Sửa đường dẫn" thì gõ được. Ô nhập tự chuẩn hoá về chữ thường không dấu và gạch ngang, nên không gõ ra được ký tự mà Strapi từ chối.
- **Đường dẫn cũ tự chuyển hướng.** Khi bài đã đăng mà đổi đường dẫn, server (`admin-ui` update) cất đường dẫn cũ vào `old_slugs` (json). Prerender ghi trang `/tin-tuc/<cũ>/` dạng meta refresh 0 giây cộng canonical; Google coi dạng này là chuyển hướng vĩnh viễn. app.js cũng tự chuyển khi gặp slug cũ.
- **Trường mới trong `news`:** `seo_title`, `seo_description`, `focus_keyword`, `share_image`, `old_slugs`. Trường nào bỏ trống thì lấy giá trị sẵn có: tiêu đề, tóm tắt, ảnh đại diện.
- **Khối "Kiểm tra SEO"** trong form: xem trước kết quả Google, đếm ký tự, và danh sách kiểm (từ khoá nằm ở tiêu đề/mô tả/đường dẫn/đoạn đầu, độ dài bài, có H2, ảnh có mô tả, có link nội bộ).
- **Link:** link trong website mở cùng tab và không gắn nofollow. Link ra ngoài mặc định mở tab mới và gắn `noopener`; nofollow là tuỳ chọn. Hộp chèn link có ô tìm bài viết/sản phẩm/trang để gắn link nội bộ nhanh.

## 2. Ảnh trong bài

Khi chọn một ảnh, thanh công cụ ảnh hiện ra để sửa mô tả (alt), chú thích (lưu ở `title`, website hiện thành `<figcaption>`), cỡ (nhỏ/vừa/toàn khổ) và căn (trái/giữa/phải). Cỡ và căn lưu bằng class trong danh sách cho phép (`img-sm|img-md|img-full`, `align-left|align-center|align-right`).

## 3. Công cụ soạn thảo

Gạch chân, căn lề đoạn văn, bảng (thêm/xoá hàng cột), nhúng YouTube (iframe chỉ nhận youtube.com hoặc youtube-nocookie.com/embed), hoàn tác/làm lại, khung nổi bật (`div.article-callout`), nút kêu gọi (link có class `article-btn`). Bộ lọc `sanitizeArticleHtml` trong app.js được mở thêm đúng những thẻ và thuộc tính này, không hơn.

## 4. Chia sẻ Facebook/Zalo

Prerender ghi thêm `/tin-tuc/<slug>/index.html` cho từng bài đã đăng, dựng từ news-detail.html đã ghi cài đặt. Trong đó điền sẵn title, description, og:*, canonical và JSON-LD `NewsArticle`. Phần thân bài vẫn do app.js dựng như cũ, nên chỉ có một bộ lọc HTML. Nginx đổi `try_files $uri /news-detail.html` thành `try_files $uri $uri/index.html /news-detail.html`. Prerender sở hữu riêng thư mục `tin-tuc/` (xoá thư mục của bài đã xoá hoặc đổi tên) và rsync lúc deploy bỏ qua thư mục này. Lưu, xoá hay đăng bài đều chạy lại prerender (lifecycles).
