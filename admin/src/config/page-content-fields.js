// Các ô của mục "Nội dung trang". Khoá phải trùng khai báo phía CMS
// (dha-cms/src/api/page-content/fields.js) — test tests/page-content.test.js giữ
// hai bên khớp nhau. Placeholder là chữ đang nằm sẵn trong HTML: bỏ trống ô thì
// website dùng lại đúng chữ đó.
export const PAGE_TABS = [
  {
    code: 'home',
    label: 'Trang chủ',
    fields: [
      { key: 'hero_primary_label', label: 'Nút chính ở đầu trang — chữ', type: 'text', placeholder: 'Xem Danh Mục Quặng' },
      { key: 'hero_primary_url', label: 'Nút chính ở đầu trang — link', type: 'url', placeholder: '/products' },
      { key: 'hero_secondary_label', label: 'Nút phụ ở đầu trang — chữ', type: 'text', placeholder: 'Tính Giá Nhanh' },
      { key: 'hero_secondary_url', label: 'Nút phụ ở đầu trang — link', type: 'url', placeholder: '/estimator' },
      { key: 'prices_title', label: 'Tiêu đề khu Giá thị trường', type: 'text', placeholder: 'Giá Kim Loại Thị Trường' },
      { key: 'prices_cta_label', label: 'Chữ nút gọi ở khu Giá thị trường', type: 'text', placeholder: 'Gọi Nhận Báo Giá' },
      { key: 'news_title', label: 'Tiêu đề khu Tin tức', type: 'text', placeholder: 'Tin Tức Thị Trường' },
      { key: 'news_link_label', label: 'Chữ link xem tất cả tin tức', type: 'text', placeholder: 'Xem tất cả tin tức →' },
      { key: 'sidebar_categories_title', label: 'Tiêu đề khối danh mục bên hông', type: 'text', placeholder: 'DANH MỤC SẢN PHẨM' },
      { key: 'products_tag', label: 'Nhãn nhỏ khu Sản phẩm', type: 'text', placeholder: 'DANH MỤC SẢN PHẨM' },
      { key: 'products_title', label: 'Tiêu đề khu Sản phẩm (xuống dòng được)', type: 'textarea', placeholder: 'QUẶNG MẪU\nTIÊU CHUẨN' },
      { key: 'products_link_label', label: 'Chữ link xem toàn bộ danh mục', type: 'text', placeholder: 'Xem toàn bộ danh mục' },
      { key: 'services_tag', label: 'Nhãn nhỏ khu Dịch vụ', type: 'text', placeholder: 'HẠNG MỤC CUNG CẤP & KHẢO SÁT' },
      { key: 'services_title', label: 'Tiêu đề khu Dịch vụ', type: 'text', placeholder: 'KHOÁNG SẢN & DỊCH VỤ ĐỊA CHẤT' },
      { key: 'services_description', label: 'Mô tả khu Dịch vụ', type: 'textarea', placeholder: 'Cung cấp mẫu quặng, phân tích hàm lượng hóa học…' },
      { key: 'workflow_tag', label: 'Nhãn nhỏ khu Quy trình', type: 'text', placeholder: 'QUY TRÌNH THỰC HIỆN' },
      { key: 'workflow_title', label: 'Tiêu đề khu Quy trình', type: 'text', placeholder: 'QUY TRÌNH THU THẬP & KIỂM ĐỊNH MẪU' },
      { key: 'workflow_description', label: 'Mô tả khu Quy trình', type: 'textarea', placeholder: 'Quy trình xử lý và đóng gói chuẩn hóa…' },
    ],
  },
  {
    code: 'products',
    label: 'Sản phẩm',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Sản Phẩm Kim Loại Màu & Quặng' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Cung cấp đa dạng các loại kim loại màu và quặng khoáng sản…' },
      { key: 'cta_title', label: 'Tiêu đề khung báo giá cuối trang', type: 'text', placeholder: 'CẦN BÁO GIÁ CHI TIẾT?' },
      { key: 'cta_call_label', label: 'Chữ nút gọi hotline', type: 'text', placeholder: 'Gọi Hotline Ngay' },
      { key: 'cta_contact_label', label: 'Chữ nút gửi yêu cầu', type: 'text', placeholder: 'Gửi Yêu Cầu Báo Giá' },
    ],
  },
  {
    code: 'projects',
    label: 'Dự án',
    fields: [
      { key: 'tag', label: 'Nhãn nhỏ', type: 'text', placeholder: 'DỰ ÁN TIÊU BIỂU' },
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'CÁC DỰ ÁN KIỂM ĐỊNH VÀ KHẢO SÁT' },
      { key: 'description', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Thông số kỹ thuật các dự án phân tích mẫu quặng…' },
    ],
  },
  {
    code: 'news',
    label: 'Tin tức',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Tin Tức Thị Trường' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Cập nhật tin tức giá cả kim loại…' },
    ],
  },
  {
    code: 'pricing',
    label: 'Bảng giá',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Bảng Giá Kim Loại' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Giá tham khảo cập nhật theo sàn London Metal Exchange…' },
      { key: 'cta_label', label: 'Chữ nút gọi báo giá', type: 'text', placeholder: 'Gọi Nhận Báo Giá Chính Xác' },
      { key: 'survey_title', label: 'Tiêu đề khu Biểu phí khảo sát', type: 'text', placeholder: 'Biểu Phí Khảo Sát Địa Chất' },
      { key: 'survey_description', label: 'Mô tả khu Biểu phí khảo sát', type: 'textarea', placeholder: 'Đơn giá dịch vụ khảo sát thực địa và đo đạc mỏ quặng.' },
    ],
  },
  {
    code: 'estimator',
    label: 'Dự toán',
    fields: [
      { key: 'tag', label: 'Nhãn nhỏ', type: 'text', placeholder: 'HỆ THỐNG ĐỊNH GIÁ' },
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'DỰ TÍNH CHI PHÍ MẪU' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Nhập các thông số bên dưới để ước lượng tổng chi phí…' },
      { key: 'note', label: 'Đoạn "Lưu ý" dưới kết quả', type: 'textarea', placeholder: 'Báo giá dựa trên biểu phí cơ sở tại phòng phân tích của DHA…' },
      { key: 'cta_label', label: 'Chữ nút cuối trang', type: 'text', placeholder: 'Yêu Cầu Lấy Mẫu Thử Nghiệm' },
    ],
  },
  {
    code: 'contact',
    label: 'Liên hệ',
    fields: [
      { key: 'title', label: 'Tiêu đề trang', type: 'text', placeholder: 'Liên Hệ Báo Giá' },
      { key: 'intro', label: 'Đoạn giới thiệu', type: 'textarea', placeholder: 'Gọi hotline để nhận báo giá nhanh nhất…' },
      { key: 'call_title', label: 'Tiêu đề khối gọi ngay', type: 'text', placeholder: 'GỌI NGAY ĐỂ NHẬN BÁO GIÁ' },
      { key: 'commitments_title', label: 'Tiêu đề khối cam kết', type: 'text', placeholder: 'CAM KẾT:' },
      { key: 'commitments', label: 'Các dòng cam kết', type: 'text-list' },
      { key: 'success_title', label: 'Tiêu đề thông báo gửi thành công', type: 'text', placeholder: 'ĐÃ GỬI THÀNH CÔNG!' },
      { key: 'success_message', label: 'Nội dung thông báo gửi thành công', type: 'textarea', placeholder: 'Chúng tôi sẽ liên hệ lại qua số điện thoại bạn cung cấp trong vòng 30 phút.' },
    ],
  },
];

export const SEO_TAB_FIELDS = [
  { key: 'title', label: 'Tiêu đề trên Google', type: 'text', placeholder: 'Tối đa 70 ký tự' },
  { key: 'description', label: 'Mô tả trên Google', type: 'textarea', placeholder: 'Tối đa 200 ký tự' },
  { key: 'image', label: 'Ảnh khi chia sẻ', type: 'cloudinary-image', folder: 'dha/seo' },
  { key: 'image_alt', label: 'Mô tả ảnh chia sẻ', type: 'text', placeholder: 'Mô tả ngắn nội dung ảnh' },
];
