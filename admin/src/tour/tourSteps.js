// Nội dung các tour hướng dẫn. Đây là dữ liệu thuần, không dính React: đổi lời
// giải thích hay thêm bước chỉ cần sửa file này.
//
// Mỗi bước neo vào một thuộc tính `data-tour` trên giao diện chứ không neo vào
// className. className là chuyện của CSS, đổi lúc nào cũng được; `data-tour` là
// giao kèo công khai với tour, và có test canh để không ai xoá nhầm.
//
// Bước nào không tìm thấy mốc trên màn hình (bảng chưa có dữ liệu, menu chưa có
// mục nào) thì bị bỏ qua lúc chạy — xem `resolveSteps` trong TourProvider.

export const TOURS = {
  overview: {
    label: 'Làm quen khu quản trị',
    description: 'Đi một vòng các khu vực chính. Nên xem trước tiên.',
    steps: [
      {
        target: '[data-tour="sidebar"]',
        title: 'Menu bên trái',
        body: 'Mọi việc trong khu quản trị đều bắt đầu từ đây. Các mục được xếp theo nhóm công việc chứ không theo thứ tự bảng chữ cái.',
        placement: 'right',
      },
      {
        target: '[data-tour="nav-content"]',
        title: 'Nội dung',
        body: 'Nơi bạn thêm, sửa, xoá bài viết và dữ liệu: Tin tức, Sản phẩm, Danh mục sản phẩm, Dự án, Dịch vụ. Đây là nhóm dùng nhiều nhất.',
        placement: 'right',
      },
      {
        target: '[data-tour="nav-pages"]',
        title: 'Trang trên website',
        body: 'Chỉnh những trang đã có sẵn khung: Trang chủ, Bảng giá và Thanh menu. Bạn sửa nội dung bên trong, không tạo trang mới ở đây.',
        placement: 'right',
      },
      {
        target: '[data-tour="nav-inbox"]',
        title: 'Khách gửi về',
        body: 'Liên hệ và Đơn đặt mẫu khách điền trên website sẽ rơi vào đây. Nên ngó qua mỗi ngày.',
        placement: 'right',
      },
      {
        target: '[data-tour="nav-system"]',
        title: 'Hệ thống',
        body: 'Thư viện ảnh, Cài đặt website (thông tin liên hệ, logo) và Chữ trong form. Ít khi phải đụng tới, nhưng sửa ở đây là ảnh hưởng toàn bộ website.',
        placement: 'right',
      },
      {
        target: '[data-tour="dashboard-metrics"]',
        title: 'Bảng tổng quan',
        body: 'Các ô số đếm cho biết hiện có bao nhiêu bài viết, sản phẩm, liên hệ chưa xử lý. Bấm vào mục tương ứng bên trái để xem chi tiết.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="view-site"]',
        title: 'Xem website',
        body: 'Mở website thật trong tab mới để kiểm tra thành quả sau khi lưu. Nhớ tải lại trang nếu chưa thấy thay đổi.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="help"]',
        title: 'Cần xem lại?',
        body: 'Bấm nút này bất cứ lúc nào để chạy lại hướng dẫn. Ở mỗi màn hình, nút sẽ gợi ý đúng bài hướng dẫn cho màn hình đó.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="account"]',
        title: 'Tài khoản',
        body: 'Email đang đăng nhập. Xong việc thì bấm Đăng xuất, nhất là khi dùng máy chung.',
        placement: 'bottom',
      },
    ],
  },

  'resource-list': {
    label: 'Màn hình danh sách',
    description: 'Cách tìm, thêm, sửa, xuất bản và xoá bản ghi.',
    steps: [
      {
        target: '[data-tour="list-search"]',
        title: 'Tìm nhanh',
        body: 'Gõ vài chữ trong tiêu đề rồi bấm Tìm. Để trống rồi bấm Tìm là quay lại danh sách đầy đủ.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="list-create"]',
        title: 'Thêm mới',
        body: 'Mở form trống để tạo bản ghi mới. Form sẽ hiện đúng các ô cần điền cho loại nội dung này.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="list-table"]',
        title: 'Bảng dữ liệu',
        body: 'Mỗi dòng là một bản ghi. Các cột hiển thị là những thông tin quan trọng nhất để bạn nhận ra bản ghi cần sửa.',
        placement: 'top',
      },
      {
        target: '[data-tour="list-select-all"]',
        title: 'Chọn nhiều dòng',
        body: 'Tick vào ô đầu dòng để chọn, hoặc ô này để chọn cả trang. Khi đã chọn, nút xoá hàng loạt sẽ hiện lên cạnh nút Thêm mới.',
        placement: 'right',
      },
      {
        target: '[data-tour="list-actions"]',
        title: 'Thao tác trên từng dòng',
        body: 'Sửa để mở form chỉnh. Xuất bản / Gỡ xuất bản quyết định bài có hiện trên website hay không — bản nháp thì khách không thấy. Xoá là mất hẳn, không lấy lại được.',
        placement: 'left',
      },
      {
        target: '[data-tour="list-pagination"]',
        title: 'Chuyển trang',
        body: 'Danh sách dài sẽ chia thành nhiều trang. Dùng Trước / Sau để đi tiếp.',
        placement: 'top',
      },
    ],
  },

  'resource-edit': {
    label: 'Màn hình soạn thảo',
    description: 'Các ô nhập đặc biệt và cách lưu.',
    steps: [
      {
        target: '[data-tour="savebar"]',
        title: 'Thanh lưu',
        body: 'Luôn bám ở đầu màn hình, cuộn xuống đâu cũng bấm Lưu được. Rời khỏi trang mà chưa bấm Lưu là mất hết thay đổi.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="edit-fields"]',
        title: 'Các ô nhập',
        body: 'Ô có dấu * là bắt buộc. Dòng chữ mờ bên dưới mỗi ô là gợi ý cách điền — đọc kỹ dòng đó trước khi nhập.',
        placement: 'top',
      },
      {
        target: '[data-tour="field-slug"]',
        title: 'Đường dẫn bài viết',
        body: 'Tự sinh ra từ tiêu đề, thường không cần sửa. Nếu bài đã đăng rồi thì đừng đổi: link cũ khách đang giữ sẽ hỏng.',
        placement: 'top',
      },
      {
        target: '[data-tour="field-richtext"]',
        title: 'Trình soạn thảo',
        body: 'Bôi đen chữ rồi dùng thanh công cụ để in đậm, đặt tiêu đề hoặc gắn liên kết. Ảnh chèn trong bài sẽ tự tải lên thư viện.',
        placement: 'top',
      },
      {
        target: '[data-tour="field-cloudinary-image"]',
        title: 'Ảnh',
        body: 'Chọn ảnh có sẵn trong thư viện hoặc tải ảnh mới lên. Nên dùng ảnh ngang, dung lượng vừa phải để trang tải nhanh.',
        placement: 'top',
      },
    ],
  },

  home: {
    label: 'Trang chủ',
    description: 'Slide, quy trình và phần giới thiệu.',
    steps: [
      {
        target: '[data-tour="home-cards"]',
        title: 'Slide và quy trình',
        body: 'Hai khối này có danh sách riêng. Bấm nút trong thẻ để sang màn hình quản lý slide banner đầu trang, hoặc các bước quy trình làm việc.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="edit-fields"]',
        title: 'Nội dung giới thiệu',
        body: 'Đoạn giới thiệu và các con số thành tích hiện trên trang chủ. Sửa xong nhớ bấm Lưu ở thanh trên cùng.',
        placement: 'top',
      },
    ],
  },

  pricing: {
    label: 'Bảng giá',
    description: 'Ba bảng giá con nằm ở đâu.',
    steps: [
      {
        target: '[data-tour="pricing-cards"]',
        title: 'Ba nhóm giá',
        body: 'Giá kim loại, biểu phí phân tích và biểu phí khảo sát được quản lý tách riêng. Bấm vào thẻ tương ứng để mở danh sách và sửa từng dòng giá.',
        placement: 'bottom',
      },
    ],
  },

  menu: {
    label: 'Thanh menu',
    description: 'Sắp xếp mục điều hướng trên đầu website.',
    steps: [
      {
        target: '[data-tour="menu-preview"]',
        title: 'Khách sẽ thấy',
        body: 'Khung xem trước mô phỏng thanh menu thật trên website. Sửa bên dưới thì khung này đổi theo ngay, chưa cần lưu.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="menu-row"]',
        title: 'Một mục menu',
        body: 'Mỗi dòng gồm tên hiện ra cho khách và đường dẫn khi bấm vào. Đường dẫn sai sẽ có cảnh báo màu cam ngay bên dưới.',
        placement: 'top',
      },
      {
        target: '[data-tour="menu-drag"]',
        title: 'Đổi thứ tự',
        body: 'Kéo tay nắm này để sắp lại thứ tự, hoặc dùng hai nút mũi tên lên/xuống bên cạnh nếu kéo thả khó thao tác.',
        placement: 'right',
      },
      {
        target: '[data-tour="menu-row-actions"]',
        title: 'Mục con, ẩn hiện, xoá',
        body: 'Nút thụt vào biến dòng này thành mục con của dòng ngay trên. Nút hình con mắt tạm ẩn khỏi website mà không mất dữ liệu. Nút thùng rác xoá hẳn.',
        placement: 'left',
      },
      {
        target: '[data-tour="menu-add"]',
        title: 'Thêm mục',
        body: 'Thêm một dòng trống ở cuối, rồi kéo về đúng vị trí. Xong tất cả mới bấm Lưu thay đổi ở thanh trên cùng.',
        placement: 'top',
      },
    ],
  },

  media: {
    label: 'Thư viện ảnh',
    description: 'Tải ảnh lên và lấy link ảnh.',
    steps: [
      {
        target: '[data-tour="media-upload"]',
        title: 'Tải ảnh lên',
        body: 'Chọn thư mục đúng loại nội dung trước (tin tức, sản phẩm, dự án...), rồi chọn tệp và bấm Tải ảnh lên. Thư mục ảnh cũ chỉ xem, không tải thêm được.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="media-grid"]',
        title: 'Ảnh đã có',
        body: 'Toàn bộ ảnh trong thư mục đang chọn. Chép link để dán vào chỗ cần, hoặc xoá ảnh không dùng nữa — nhưng kiểm tra kỹ, ảnh đang được bài viết dùng mà xoá thì bài đó sẽ mất ảnh.',
        placement: 'top',
      },
    ],
  },

  settings: {
    label: 'Cài đặt website',
    description: 'Logo, liên hệ và chữ mặc định cho giá.',
    steps: [
      {
        target: '[data-tour="savebar"]',
        title: 'Ảnh hưởng toàn website',
        body: 'Những gì sửa ở màn hình này hiện trên mọi trang. Sửa xong bấm Lưu rồi mở website kiểm tra lại.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="settings-logo"]',
        title: 'Logo & favicon',
        body: 'Tải ảnh logo lên. Bỏ trống thì website tự dùng logo chữ khai báo ngay bên dưới.',
        placement: 'top',
      },
      {
        target: '[data-tour="settings-contact"]',
        title: 'Thông tin liên hệ',
        body: 'Địa chỉ, điện thoại, email hiện ở chân trang và trang Liên hệ. Đây là chỗ duy nhất cần sửa khi công ty đổi số điện thoại.',
        placement: 'top',
      },
      {
        target: '[data-tour="settings-price"]',
        title: 'Giá & báo giá',
        body: 'Chữ mặc định thay cho con số khi sản phẩm để "giá liên hệ", và đơn vị giá mặc định. Từng sản phẩm vẫn có thể đặt chữ riêng đè lên.',
        placement: 'top',
      },
    ],
  },

  'form-labels': {
    label: 'Chữ trong form',
    description: 'Đổi tên ô nhập trong chính khu quản trị này.',
    steps: [
      {
        target: '[data-tour="labels-picker"]',
        title: 'Chọn form cần sửa',
        body: 'Mỗi loại nội dung có bộ ô nhập riêng. Chọn form ở đây rồi mới sửa chữ bên dưới.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="labels-editor"]',
        title: 'Đổi chữ',
        body: 'Ô trái là tên hiển thị, ô phải là câu hướng dẫn nhỏ bên dưới. Bỏ trống là dùng lại chữ mặc định đang hiện mờ trong ô.',
        placement: 'top',
      },
    ],
  },
};

// Ánh xạ đường dẫn sang tour của màn hình đó. Xếp từ cụ thể tới tổng quát: một
// đường dẫn khớp mẫu đầu tiên là dừng.
const ROUTE_TOURS = [
  [/^\/resources\/[^/]+\/.+$/, 'resource-edit'],
  [/^\/resources\/[^/]+$/, 'resource-list'],
  [/^\/home$/, 'home'],
  [/^\/pricing$/, 'pricing'],
  [/^\/menu$/, 'menu'],
  [/^\/media$/, 'media'],
  [/^\/settings$/, 'settings'],
  [/^\/form-labels$/, 'form-labels'],
  [/^\/$/, 'overview'],
];

export function tourIdForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = ROUTE_TOURS.find(([pattern]) => pattern.test(path));
  return match ? match[1] : null;
}

export const OVERVIEW_TOUR_ID = 'overview';
