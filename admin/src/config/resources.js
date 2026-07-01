export const RESOURCE_CONFIG = {
  'news': {
    label: 'Tin tức',
    titleField: 'title',
    draftAndPublish: true,
    listFields: ['title', 'category', 'date', 'publishedAt'],
    fields: {
      title: { label: 'Tiêu đề', type: 'text', required: true },
      slug: { label: 'Đường dẫn', type: 'text', required: true },
      summary: { label: 'Tóm tắt', type: 'textarea', required: true },
      content: { label: 'Nội dung', type: 'richtext', required: true },
      category: { label: 'Danh mục', type: 'select', options: ['gia-ca', 'quoc-te', 'noi-dia', 'phan-tich', 'cong-nghe'] },
      date: { label: 'Ngày đăng', type: 'date', required: true },
      image: { label: 'Ảnh đại diện', type: 'cloudinary-image', folder: 'ha-can/news' },
    },
  },
  'products': {
    label: 'Sản phẩm',
    titleField: 'name',
    listFields: ['name', 'group', 'price', 'featured', 'in_stock'],
    fields: {
      uid: { label: 'Mã/đường dẫn', type: 'text', required: true },
      name: { label: 'Tên sản phẩm', type: 'text', required: true },
      group: { label: 'Nhóm', type: 'select', options: ['dong', 'nhom', 'chi', 'thiec', 'quang'] },
      grade: { label: 'Hàm lượng/grade', type: 'text' },
      origin: { label: 'Nguồn gốc', type: 'text' },
      price: { label: 'Giá', type: 'number' },
      description: { label: 'Mô tả', type: 'textarea' },
      specs: { label: 'Thông số', type: 'key-value-table' },
      image: { label: 'Ảnh sản phẩm', type: 'cloudinary-image', folder: 'ha-can/products' },
      featured: { label: 'Nổi bật', type: 'boolean' },
      in_stock: { label: 'Còn hàng', type: 'boolean' },
      sort_order: { label: 'Thứ tự', type: 'number' },
    },
  },
  'projects': {
    label: 'Dự án',
    titleField: 'name',
    draftAndPublish: true,
    listFields: ['name', 'location', 'method', 'publishedAt'],
    fields: {
      name: { label: 'Tên dự án', type: 'text', required: true },
      location: { label: 'Địa điểm', type: 'text', required: true },
      scale: { label: 'Quy mô', type: 'text' },
      method: { label: 'Phương pháp', type: 'text' },
      value: { label: 'Giá trị', type: 'text' },
      cloudinary_image_url: { label: 'Ảnh dự án', type: 'cloudinary-image', folder: 'ha-can/projects', publicIdField: 'cloudinary_public_id' },
      cloudinary_public_id: { label: 'Cloudinary public ID', type: 'hidden' },
    },
  },
  'services': { label: 'Dịch vụ', titleField: 'title', draftAndPublish: true, listFields: ['title', 'link_text', 'sort_order', 'publishedAt'], fields: { title: { label: 'Tiêu đề', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea', required: true }, features: { label: 'Tính năng', type: 'text-list' }, icon_svg: { label: 'Icon SVG', type: 'textarea' }, link_url: { label: 'Liên kết', type: 'text' }, link_text: { label: 'Chữ trên nút', type: 'text' }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'hero-slides': { label: 'Hero slide', titleField: 'title', draftAndPublish: true, listFields: ['title', 'subtitle', 'sort_order', 'publishedAt'], fields: { subtitle: { label: 'Dòng phụ', type: 'text', required: true }, title: { label: 'Tiêu đề', type: 'text', required: true }, image_url: { label: 'Ảnh slide', type: 'cloudinary-image', folder: 'ha-can/hero' }, image_alt: { label: 'Mô tả ảnh', type: 'textarea' }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'workflow-steps': { label: 'Bước quy trình', titleField: 'title', draftAndPublish: true, listFields: ['step_number', 'title', 'sort_order', 'publishedAt'], fields: { step_number: { label: 'Số bước', type: 'number', required: true }, title: { label: 'Tiêu đề', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea', required: true }, sort_order: { label: 'Thứ tự', type: 'number' } } },
  'pricing-packages': { label: 'Giá kim loại', titleField: 'metal', listFields: ['metal', 'lme_price', 'domestic_price', 'trend', 'updated'], fields: { metal: { label: 'Kim loại', type: 'text', required: true }, lme_price: { label: 'Giá LME', type: 'text' }, domestic_price: { label: 'Giá nội địa', type: 'text' }, unit: { label: 'Đơn vị', type: 'text' }, change: { label: 'Thay đổi', type: 'text' }, trend: { label: 'Xu hướng', type: 'select', options: ['up', 'down', 'stable'] }, updated: { label: 'Ngày cập nhật', type: 'date' } } },
  'pricing-analyses': { label: 'Biểu phí phân tích', titleField: 'name', draftAndPublish: true, listFields: ['name', 'tech', 'unit', 'price', 'publishedAt'], fields: { name: { label: 'Tên hạng mục', type: 'text', required: true }, tech: { label: 'Kỹ thuật', type: 'text' }, unit: { label: 'Đơn vị', type: 'text' }, price: { label: 'Giá', type: 'number', required: true }, duration: { label: 'Thời gian', type: 'text' }, category: { label: 'Nhóm', type: 'select', options: ['chemical', 'physical'] } } },
  'pricing-surveys': { label: 'Biểu phí khảo sát', titleField: 'name', draftAndPublish: true, listFields: ['name', 'price', 'publishedAt'], fields: { name: { label: 'Tên dịch vụ', type: 'text', required: true }, price: { label: 'Giá', type: 'text', required: true }, description: { label: 'Mô tả', type: 'textarea' } } },
  'contact-inquiries': { label: 'Yêu cầu liên hệ', titleField: 'name', readOnlyCreate: true, listFields: ['name', 'phone', 'service', 'status', 'createdAt'], fields: { status: { label: 'Trạng thái', type: 'select', options: ['new', 'contacted', 'completed'] } } },
  'order-requests': { label: 'Đơn đặt mẫu', titleField: 'customer_name', readOnlyCreate: true, listFields: ['product_name', 'customer_name', 'phone', 'quantity', 'status', 'createdAt'], fields: { status: { label: 'Trạng thái', type: 'select', options: ['new', 'processing', 'done'] } } },
};

export function getResourceConfig(type) {
  return RESOURCE_CONFIG[type];
}
