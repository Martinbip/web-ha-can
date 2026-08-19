import React, { useEffect } from 'react';
import { slugify } from '../lib/slug.js';

// Đường dẫn bài viết luôn bám theo tiêu đề, không có ô nhập và không có nút
// nào để bấm: trường này ở Strapi là kiểu `uid` (chỉ nhận chữ thường, số và
// gạch ngang), nên mọi lựa chọn để người dùng tự gõ đều dẫn tới lỗi "ký tự lạ"
// mà biên tập viên không có cách nào đoán ra. Hiển thị ở đây chỉ để biết bài
// viết sẽ nằm ở địa chỉ nào.
//
// Đánh đổi có chủ đích: sửa tiêu đề của một bài đã đăng cũng đổi luôn địa chỉ
// của nó, nên link đã chia sẻ trước đó sẽ không còn mở được.
export default function SlugField({ id, value, onChange, sourceValue, previewBase }) {
  useEffect(() => {
    const next = slugify(sourceValue);
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceValue, value]);

  return (
    <div className="slug-field">
      <p className="slug-field-preview" id={id}>
        {value ? `${previewBase || ''}${value}` : 'Sẽ tự tạo từ tiêu đề khi bạn nhập tiêu đề.'}
      </p>
      <p className="slug-field-hint">Địa chỉ bài viết trên website, tự tạo từ tiêu đề — bạn không cần nhập gì.</p>
    </div>
  );
}
