import React, { useEffect, useRef, useState } from 'react';
import { slugify, slugifyTyping } from '../lib/slug.js';

// Đường dẫn (slug) mặc định tự bám theo tiêu đề — biên tập viên không phải gõ
// gì. Trường này ở Strapi là kiểu `uid` (chỉ nhận chữ thường, số và gạch
// ngang), nên trước đây không có ô nhập nào để khỏi gõ ra lỗi "ký tự lạ".
//
// `editable` (tin tức): có nút "Sửa đường dẫn" mở ô nhập — mọi thứ gõ vào được
// chuẩn hoá ngay về dạng hợp lệ, nên vẫn không thể gõ sai. Bài đã có thì thôi
// bám tiêu đề (sửa tiêu đề không làm chết link đã chia sẻ); tự sửa đường dẫn
// của bài đã đăng thì server cất đường dẫn cũ để website tự chuyển hướng.
//
// `locked` (field.lockAfterCreate, vd mã danh mục sản phẩm): mã nằm trong link
// lọc và trong mọi sản phẩm đã gán, nên chỉ tự sinh lúc tạo mới. Bản ghi đã có
// thì giữ nguyên mã — trước đây chỉ cần mở trang sửa rồi bấm Lưu là mã
// "black-metal" bị đổi thành "kim-loai-den" theo tên.
export default function SlugField({
  id,
  value,
  onChange,
  sourceValue,
  previewBase,
  locked = false,
  editable = false,
  existing = false,
  published = false,
}) {
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const original = useRef(null);
  if (existing && value && original.current === null) original.current = value;

  // Bản ghi đã có của trường editable cũng thôi bám tiêu đề, như locked.
  const follows = !(locked && value) && !(editable && (existing || manual));

  useEffect(() => {
    if (!follows) return;
    const next = slugify(sourceValue);
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceValue, value, follows]);

  if (locked && value) {
    return (
      <div className="slug-field">
        <p className="slug-field-preview" id={id}>{`${previewBase || ''}${value}`}</p>
        <p className="slug-field-hint">Mã được tạo một lần lúc thêm mới và giữ nguyên khi sửa tên, để các link đã dùng không bị đổi.</p>
      </div>
    );
  }

  const changedFromPublished = published && original.current && value && value !== original.current;

  return (
    <div className="slug-field">
      {editing ? (
        <div className="slug-field-edit">
          {previewBase ? <span className="slug-field-base">{previewBase}</span> : null}
          <input
            id={id}
            type="text"
            value={value || ''}
            placeholder="vi-du-duong-dan-bai-viet"
            onChange={(event) => {
              setManual(true);
              onChange(slugifyTyping(event.target.value));
            }}
            onBlur={() => onChange(slugify(value) || slugify(sourceValue))}
            autoFocus
          />
        </div>
      ) : (
        <p className="slug-field-preview" id={id}>
          {value ? `${previewBase || ''}${value}` : 'Sẽ tự tạo từ tiêu đề khi bạn nhập tiêu đề.'}
        </p>
      )}

      {editable ? (
        <div className="slug-field-actions">
          {!editing ? (
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Sửa đường dẫn</button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Xong</button>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={!slugify(sourceValue) || slugify(sourceValue) === value}
            onClick={() => {
              setManual(true);
              onChange(slugify(sourceValue));
            }}
          >
            Tạo lại theo tiêu đề
          </button>
        </div>
      ) : null}

      <p className="slug-field-hint">
        {editable
          ? 'Đường dẫn ngắn, có từ khoá chính, không dấu, nối bằng gạch ngang là tốt nhất cho SEO. Chữ có dấu, khoảng trắng tự được đổi cho đúng dạng.'
          : 'Địa chỉ bài viết trên website, tự tạo từ tiêu đề — bạn không cần nhập gì.'}
        {editable && existing ? ' Bài đã có thì sửa tiêu đề không làm đổi đường dẫn.' : ''}
      </p>
      {changedFromPublished ? (
        <p className="slug-field-warning">
          Bài đang đăng ở {`${previewBase || ''}${original.current}`}. Sau khi lưu, link cũ tự chuyển sang đường dẫn mới — link đã chia sẻ không bị chết.
        </p>
      ) : null}
    </div>
  );
}
