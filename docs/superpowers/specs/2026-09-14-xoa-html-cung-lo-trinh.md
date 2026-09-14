# Lộ trình bỏ nội dung viết cứng trong HTML

Ngày 14/09/2026.

## Mục tiêu

Mọi nội dung khách nhìn thấy trên website đều do quản trị sửa trong admin, và
HTML phục vụ cho khách luôn mang sẵn dữ liệu mới nhất (ghi lúc deploy và ngay
sau mỗi lần lưu). Không còn chỗ nào phải sửa code mới đổi được chữ.

## Kết quả rà soát (9 trang công khai)

Rà bằng script: bỏ các vùng đã nối CMS (xem `app.js` và
`scripts/prerender-site-settings.js`), in phần chữ còn lại. `preview.html` là
trang xem trước của admin (`noindex`), không tính.

1. **Danh sách danh mục.** Khối bên hông trang chủ và cột danh mục ở chân trang
   của cả 9 trang viết cứng, phần lớn dùng mã lọc cũ (`?filter=dong`...) nên dẫn
   khách tới trang trống. Nút "← Quay Lại Danh Mục" ở chi tiết sản phẩm cũng vậy.
2. **Chân trang và đầu trang.** Có hai phiên bản chân trang: nhóm A (trang chủ,
   Sản phẩm, Dự án, Dự toán) ký "Kim Loại Màu DHA", nhóm B (Tin tức, Chi tiết
   tin, Chi tiết sản phẩm, Bảng giá, Liên hệ) ký "DHA Minerals". Cột liên kết,
   dòng bản quyền viết cứng; link "Giới Thiệu" trỏ `/#about` không tồn tại. Nút
   góc phải đầu trang lúc "Yêu Cầu Mẫu", lúc "Liên Hệ Báo Giá".
3. **Chữ nội dung từng trang.** Tiêu đề và mô tả các khu ở trang chủ, nút ở
   hero, tiêu đề và đoạn giới thiệu của các trang con, khung "Cần báo giá chi
   tiết?", khối "Cam kết" và thông báo gửi thành công ở trang Liên hệ, đoạn
   "Lưu ý" ở Dự toán, chữ trong khung hotline.
4. **SEO.** `title`, `description` và các thẻ `og:` của cả 9 trang.
5. **Dữ liệu nghiệp vụ trong code.** Dự toán: giá đóng gói, phí CO, ngưỡng và
   tỉ lệ chiết khấu, nhóm khoáng sản, bảng quặng dự phòng có giá. Liên hệ: danh
   sách "Nhu cầu" khoá cứng bằng enum trong schema CMS.
6. **Nhãn giao diện và thông báo hệ thống.** Nhãn ô nhập, tiêu đề cột bảng,
   "Đang tải...", "Không có sản phẩm nào...", "0đ".

## Quyết định

Nhóm 6 **giữ trong code**: đó là chữ giao diện, gần như không đổi, đưa vào admin
chỉ làm admin rối và dễ xoá nhầm nhãn ô nhập. Test chống tái phát có danh sách
cho phép riêng cho nhóm này.

Nhóm 1–5 làm theo 4 đợt, mỗi đợt một spec, một kế hoạch, một lần triển khai:

| Đợt | Phạm vi | Nhóm |
|---|---|---|
| 1 | Danh mục sản phẩm + khung hotline | 1, một phần 3 |
| 2 | Chân trang và đầu trang dùng chung, sửa `/#about` | 2 |
| 3 | Nội dung từng trang + SEO, ghi sẵn vào HTML lúc deploy | 3, 4 |
| 4 | Cấu hình Dự toán + danh sách nhu cầu form Liên hệ | 5 |

Thứ tự này đi từ chỗ đang hỏng (link dẫn ra trang trống) tới chỗ chỉ bất tiện.
Đợt 4 đứng cuối vì đụng tới số tiền báo cho khách và cần đối chiếu với bảng giá
thật.

## Nguyên tắc chung cho cả 4 đợt

- **Một nguồn.** Mỗi mẩu nội dung chỉ có một chỗ sửa trong admin; mọi trang dùng
  chung nó.
- **Không chớp.** Nội dung được ghi sẵn vào HTML đang phục vụ bằng
  `scripts/prerender-site-settings.js`, chạy lúc deploy và ngay sau mỗi lần lưu
  (`dha-cms/src/api/site-setting/prerender.js`). `app.js` vẫn dựng lại khi CMS
  trả lời thật, và giữ nguyên HTML khi CMS lỗi.
- **JS và prerender dựng ra cùng một đoạn HTML**, cùng quy tắc escape — lệch nhau
  là chớp. Mỗi đợt có test so khớp hai bên.
- **HTML trong repo mang dữ liệu mặc định hợp lệ**, không mang dữ liệu mẫu sai
  (link hỏng, tên thương hiệu cũ).
- **Test chống tái phát.** Mỗi đợt mở rộng một test quét HTML: chữ khách nhìn
  thấy phải nằm trong vùng đã nối CMS hoặc trong danh sách cho phép của nhóm 6.
  Sau đợt 3 danh sách cho phép chỉ còn nhóm 6.

## Việc còn nợ

`scripts/prerender-site-settings.js` ghi tại chỗ vào thư mục đang phục vụ
(`/var/www/dhakimloaimau.vn`), không đọc từ bản mẫu trong repo
(`/var/www/web-ha-can/*.html`). Vì vậy một ô để trống trong admin không quay
về giá trị mặc định — nó giữ nguyên nội dung của lần ghi trước, cho tới lần
deploy kế tiếp (khi `deploy.sh` chạy `rsync` ghi đè bằng bản mẫu trong repo
rồi prerender lại). Gợi ý trong admin (đợt sửa 2026-09-14, nhóm 3) đã đổi
chữ cho đúng thực tế này thay vì hứa "về mặc định".

Cách sửa triệt để: cho prerender nhận riêng tham số nguồn (bản mẫu trong
repo, `/var/www/web-ha-can/*.html`) và tham số đích (thư mục phục vụ), luôn
đọc từ nguồn rồi ghi sang đích — khi đó "bỏ trống" sẽ thật sự quay về mặc
định ngay lần lưu tiếp theo, không cần đợi deploy. Nên làm trước hoặc trong
đợt 3.
