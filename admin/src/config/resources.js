export const RESOURCE_CONFIG = {
  'news': {
    label: 'Tin tức',
    titleField: 'title',
    draftAndPublish: true,
    listFields: ['title', 'category', 'date'],
    fields: {
      title: { label: 'Tiêu đề', type: 'text', required: true },
      slug: {
        label: 'Đường dẫn bài viết',
        type: 'slug',
        sourceField: 'title',
        previewBase: 'https://dhakimloaimau.vn/tin-tuc/',
        required: true,
      },
      summary: { label: 'Tóm tắt', type: 'textarea', required: true },
      content: { label: 'Nội dung', type: 'richtext', required: true, imageFolder: 'dha/news' },
      category: { label: 'Danh mục', type: 'select', options: ['gia-ca', 'quoc-te', 'noi-dia', 'phan-tich', 'cong-nghe'] },
      date: { label: 'Ngày đăng', type: 'date', required: true },
      image: { label: 'Ảnh đại diện', type: 'cloudinary-image', folder: 'dha/news' },
    },
  },
  'products': {
    label: 'Sản phẩm',
    titleField: 'name',
    listFields: ['name', 'group', 'price', 'featured', 'in_stock'],
    fields: {
      uid: { label: 'Mã/đường dẫn', type: 'text', required: true },
      name: { label: 'Tên sản phẩm', type: 'text', required: true },
      group: { label: 'Nhóm', type: 'select', options: ['dong', 'nhom', 'chi', 'thiec', 'quang'], hint: 'Quyết định nhãn màu góc ảnh sản phẩm. Việc lọc trên website do Danh mục hiển thị bên dưới đảm nhiệm.' },
      categories: {
        label: 'Danh mục hiển thị',
        type: 'multi-select',
        optionsFrom: 'product-categories',
        hint: 'Chọn các tab mà sản phẩm này xuất hiện ở trang chủ và trang Sản phẩm. Bỏ trống thì chỉ thấy ở tab Tất cả.',
      },
      grade: { label: 'Hàm lượng/grade', type: 'text' },
      origin: { label: 'Nguồn gốc', type: 'text' },
      price_on_request: { label: 'Giá liên hệ (không hiện số)', type: 'boolean', hint: 'Bật khi sản phẩm báo giá theo từng đơn. Website sẽ hiện chữ bên dưới thay cho con số.', clearFields: ['price', 'price_unit'] },
      price_label: { label: 'Chữ hiển thị khi giá liên hệ', type: 'text', placeholder: 'Liên hệ', hint: 'Ví dụ: Liên hệ, Báo giá theo lô. Bỏ trống sẽ dùng chữ mặc định khai báo trong Cài đặt website.' },
      price: { label: 'Giá', type: 'number', placeholder: 'Ví dụ 285000', hideWhen: 'price_on_request', emptyText: 'Liên hệ' },
      price_unit: { label: 'Đơn vị giá', type: 'text', placeholder: 'đ/kg', hideWhen: 'price_on_request', hint: 'Ghi liền ngay sau con số, ví dụ đ/kg, đ/tấn. Bỏ trống sẽ dùng đơn vị mặc định trong Cài đặt website.' },
      description: { label: 'Mô tả', type: 'textarea' },
      specs: { label: 'Thông số', type: 'key-value-table' },
      image: { label: 'Ảnh sản phẩm', type: 'cloudinary-image', folder: 'dha/products' },
      featured: { label: 'Nổi bật', type: 'boolean' },
      in_stock: { label: 'Còn hàng', type: 'boolean' },
      sort_order: { label: 'Thứ tự', type: 'number' },
    },
  },
  'product-categories': {
    label: 'Danh mục sản phẩm',
    titleField: 'name',
    listFields: ['name', 'slug', 'visible', 'sort_order'],
    fields: {
      name: { label: 'Tên danh mục', type: 'text', required: true },
      slug: { label: 'Mã danh mục', type: 'slug', sourceField: 'name', required: true, hint: 'Mã dùng trong đường dẫn lọc, ví dụ /products?filter=kim-loai-mau. Đổi mã thì các sản phẩm đã gán được cập nhật theo.' },
      visible: { label: 'Hiện trên website', type: 'boolean' },
      sort_order: { label: 'Thứ tự', type: 'number' },
    },
  },
  'projects': {
    label: 'Dự án',
    titleField: 'name',
    draftAndPublish: true,
    listFields: ['name', 'location', 'method'],
    fields: {
      name: { label: 'Tên dự án', type: 'text', required: true },
      location: { label: 'Địa điểm', type: 'text', required: true },
      scale: { label: 'Quy mô', type: 'text' },
      method: { label: 'Phương pháp', type: 'text' },
      value: { label: 'Giá trị', type: 'text' },
      cloudinary_image_url: { label: 'Ảnh dự án', type: 'cloudinary-image', folder: 'dha/projects', publicIdField: 'cloudinary_public_id' },
      cloudinary_public_id: { label: 'Cloudinary public ID', type: 'hidden' },
    },
  },
  'services': { label: 'Dịch vụ', titleField: 'title', draftAndPublish: true, listFields: ['title', 'link_text', 'sort_order'], fields: { title: { label: 'Tiêu đề', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea', required: true }, features: { label: 'Tính năng', type: 'text-list' }, icon_svg: { label: 'Icon SVG', type: 'textarea' }, link_url: { label: 'Liên kết', type: 'text' }, link_text: { label: 'Chữ trên nút', type: 'text' }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'hero-slides': { label: 'Hero slide', titleField: 'title', draftAndPublish: true, listFields: ['title', 'subtitle', 'sort_order'], fields: { subtitle: { label: 'Dòng phụ', type: 'text', required: true }, title: { label: 'Tiêu đề', type: 'text', required: true }, image_url: { label: 'Ảnh slide', type: 'cloudinary-image', folder: 'dha/hero' }, image_alt: { label: 'Mô tả ảnh', type: 'textarea' }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'workflow-steps': { label: 'Bước quy trình', titleField: 'title', draftAndPublish: true, listFields: ['step_number', 'title', 'sort_order'], fields: { step_number: { label: 'Số bước', type: 'number', required: true }, title: { label: 'Tiêu đề', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea', required: true }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'pricing-packages': { label: 'Giá kim loại', titleField: 'metal', listFields: ['metal', 'lme_price', 'domestic_price', 'trend', 'updated'], fields: { metal: { label: 'Kim loại', type: 'text', required: true }, lme_price: { label: 'Giá LME', type: 'text' }, domestic_price: { label: 'Giá nội địa', type: 'text' }, unit: { label: 'Đơn vị', type: 'text' }, change: { label: 'Thay đổi', type: 'text' }, trend: { label: 'Xu hướng', type: 'select', options: ['up', 'down', 'stable'] }, updated: { label: 'Ngày cập nhật', type: 'date' } } },
  'pricing-analyses': { label: 'Biểu phí phân tích', titleField: 'name', draftAndPublish: true, listFields: ['name', 'tech', 'unit', 'price'], fields: { name: { label: 'Tên hạng mục', type: 'text', required: true }, tech: { label: 'Kỹ thuật', type: 'text' }, unit: { label: 'Đơn vị', type: 'text' }, price: { label: 'Giá', type: 'number', required: true }, duration: { label: 'Thời gian', type: 'text' }, category: { label: 'Nhóm', type: 'select', options: ['chemical', 'physical'] } } },
  'pricing-surveys': { label: 'Biểu phí khảo sát', titleField: 'name', draftAndPublish: true, listFields: ['name', 'price'], fields: { name: { label: 'Tên dịch vụ', type: 'text', required: true }, price: { label: 'Giá', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea' } } },
  'site-setting': {
    label: 'Cài đặt website',
    titleField: 'office_name',
    singleType: true,
    listFields: ['office_name', 'hotline', 'email'],
    fields: {
      hotline: { label: 'Hotline', type: 'text', required: true },
      hotline2: { label: 'Hotline phụ', type: 'text' },
      email: { label: 'Email', type: 'email', required: true },
      address: { label: 'Địa chỉ', type: 'textarea', required: true },
      office_name: { label: 'Tên văn phòng', type: 'text' },
      tax_code: { label: 'Mã số thuế', type: 'text' },
      logo_image_url: {
        label: 'Ảnh logo',
        type: 'cloudinary-image',
        folder: 'dha/settings',
        publicIdField: 'logo_image_public_id',
        hint: 'Có ảnh thì website dùng ảnh thay cho logo chữ. Nên dùng PNG nền trong suốt, cao khoảng 88px (hiển thị 44px).',
      },
      logo_image_public_id: { label: 'Cloudinary public ID của logo', type: 'hidden' },
      logo_image_dark_url: {
        label: 'Ảnh logo cho nền tối (chân trang)',
        type: 'cloudinary-image',
        folder: 'dha/settings',
        publicIdField: 'logo_image_dark_public_id',
        hint: 'Chân trang nền đen nên logo chữ sẫm màu sẽ chìm. Bỏ trống thì chân trang dùng luôn ảnh logo chính.',
      },
      logo_image_dark_public_id: { label: 'Cloudinary public ID của logo nền tối', type: 'hidden' },
      logo_alt: { label: 'Mô tả ảnh logo', type: 'text', placeholder: 'Kim Loại Màu DHA', hint: 'Chữ đọc cho người khiếm thị và hiện khi ảnh lỗi. Bỏ trống sẽ ghép từ logo chữ.' },
      logo_text_accent: { label: 'Logo chữ — phần nhấn', type: 'text', placeholder: 'DHA', hint: 'Phần chữ màu vàng đứng trước, chỉ dùng khi không có ảnh logo.' },
      logo_text_main: { label: 'Logo chữ — phần còn lại', type: 'text', placeholder: 'MINERALS' },
      favicon_url: {
        label: 'Favicon',
        type: 'cloudinary-image',
        folder: 'dha/settings',
        publicIdField: 'favicon_public_id',
        hint: 'Biểu tượng nhỏ trên tab trình duyệt. Ảnh vuông, nên là PNG 512×512 nền trong suốt. Bỏ trống thì dùng favicon mặc định của website.',
      },
      favicon_public_id: { label: 'Cloudinary public ID của favicon', type: 'hidden' },
      facebook_url: { label: 'Facebook', type: 'url' },
      youtube_url: { label: 'YouTube', type: 'url' },
      zalo_url: { label: 'Zalo', type: 'url' },
      twitter_url: { label: 'Twitter/X', type: 'url' },
      hero_tagline: { label: 'Dòng giới thiệu trang chủ', type: 'text' },
      hero_title: { label: 'Tiêu đề trang chủ', type: 'text' },
      hero_description: { label: 'Mô tả trang chủ', type: 'textarea' },
      hero_cert_label: { label: 'Nhãn chứng chỉ', type: 'text' },
      hero_cert_value: { label: 'Giá trị chứng chỉ', type: 'text' },
      brand_bio: { label: 'Giới thiệu thương hiệu', type: 'textarea' },
      stat1_number: { label: 'Số liệu 1', type: 'text' },
      stat1_label: { label: 'Nhãn số liệu 1', type: 'text' },
      stat2_number: { label: 'Số liệu 2', type: 'text' },
      stat2_label: { label: 'Nhãn số liệu 2', type: 'text' },
      stat3_number: { label: 'Số liệu 3', type: 'text' },
      stat3_label: { label: 'Nhãn số liệu 3', type: 'text' },
      price_contact_text: { label: 'Chữ thay cho giá khi liên hệ', type: 'text', placeholder: 'Liên hệ', hint: 'Dùng cho mọi sản phẩm bật "Giá liên hệ" hoặc chưa nhập giá, trừ khi sản phẩm có chữ riêng.' },
      price_unit_default: { label: 'Đơn vị giá mặc định', type: 'text', placeholder: 'đ/kg', hint: 'Ghép ngay sau con số khi sản phẩm bỏ trống ô Đơn vị giá.' },
      price_intro_home: { label: 'Mô tả bảng giá (trang chủ)', type: 'textarea', hint: 'Câu dẫn nằm ngay dưới tiêu đề "Giá Kim Loại Thị Trường".' },
      price_note_home: { label: 'Ghi chú dưới bảng giá (trang chủ)', type: 'textarea' },
      price_note_products: { label: 'Ghi chú báo giá (trang sản phẩm)', type: 'textarea', hint: 'Câu nằm trong khối "CẦN BÁO GIÁ CHI TIẾT?" cuối trang sản phẩm.' },
      price_note_pricing: { label: 'Ghi chú dưới bảng giá (trang bảng giá)', type: 'textarea' },
      admin_labels: { label: 'Nhãn form quản trị', type: 'hidden' },
    },
  },
  'contact-inquiries': { label: 'Yêu cầu liên hệ', titleField: 'name', readOnlyCreate: true, listFields: ['name', 'phone', 'service', 'status', 'createdAt'], fields: { email: { label: 'Email', type: 'email', readOnly: true }, address: { label: 'Địa chỉ', type: 'textarea', readOnly: true }, message: { label: 'Lời nhắn', type: 'textarea', readOnly: true }, status: { label: 'Trạng thái', type: 'select', options: ['new', 'contacted', 'completed'] } } },
  'order-requests': { label: 'Đơn đặt mẫu', titleField: 'customer_name', readOnlyCreate: true, listFields: ['product_name', 'customer_name', 'phone', 'quantity', 'status', 'createdAt'], fields: { product_uid: { label: 'Mã sản phẩm', type: 'text', readOnly: true }, email: { label: 'Email', type: 'email', readOnly: true }, unit: { label: 'Đơn vị', type: 'text', readOnly: true }, note: { label: 'Ghi chú', type: 'textarea', readOnly: true }, status: { label: 'Trạng thái', type: 'select', options: ['new', 'processing', 'done'] } } },
};

// Nhãn và câu hướng dẫn trong form là chữ của người quản trị, không phải hằng số
// kỹ thuật. Quản trị viên sửa chúng ở trang "Chữ trong form quản trị"; bản sửa
// được nạp một lần khi vào admin rồi phủ lên cấu hình gốc bên dưới.
let LABEL_OVERRIDES = {};

export function setLabelOverrides(overrides) {
  LABEL_OVERRIDES = overrides && typeof overrides === 'object' ? overrides : {};
}

export function getLabelOverrides() {
  return LABEL_OVERRIDES;
}

function applyOverrides(type, config) {
  const overrides = LABEL_OVERRIDES[type];
  if (!overrides || !config.fields) return config;

  const fields = Object.fromEntries(
    Object.entries(config.fields).map(([name, field]) => {
      const override = overrides[name];
      if (!override) return [name, field];
      const next = { ...field };
      // Chuỗi rỗng nghĩa là "bỏ hẳn câu hướng dẫn", khác với chưa từng sửa.
      if (typeof override.label === 'string' && override.label.trim()) next.label = override.label.trim();
      if (typeof override.hint === 'string') next.hint = override.hint.trim() || undefined;
      return [name, next];
    }),
  );

  return { ...config, fields };
}

export function getResourceConfig(type) {
  const config = RESOURCE_CONFIG[type];
  return config ? applyOverrides(type, config) : config;
}
