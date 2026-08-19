import React, { useEffect, useRef, useState } from 'react';
import { normalizeSlugInput, slugify } from '../lib/slug.js';

// Trường "đường dẫn" của Strapi chỉ nhận chữ thường/số/gạch ngang. Bắt biên tập
// viên tự gõ dẫn tới việc dán nguyên link web rồi bị báo "ký tự lạ", nên mặc
// định hệ thống tự sinh từ tiêu đề và chỉ mở ra khi người dùng chủ động bấm sửa.
export default function SlugField({ id, value, onChange, sourceValue, previewBase }) {
  // Bài đã có đường dẫn thì giữ nguyên: đổi tiêu đề của bài cũ mà đổi luôn URL
  // sẽ làm hỏng mọi liên kết đã chia sẻ.
  const [locked, setLocked] = useState(() => Boolean(value));
  const [editing, setEditing] = useState(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (lockedRef.current) return;
    const next = slugify(sourceValue);
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceValue]);

  function handleManualChange(input) {
    setLocked(true);
    onChange(normalizeSlugInput(input));
  }

  const preview = `${previewBase || ''}${value || ''}`;

  return (
    <div className="slug-field">
      {editing ? (
        <input
          id={id}
          type="text"
          className="slug-field-input"
          value={value || ''}
          placeholder="duong-dan-bai-viet"
          onChange={(event) => handleManualChange(event.target.value)}
        />
      ) : (
        <p className="slug-field-preview" id={id}>
          {value ? preview : 'Sẽ tự tạo từ tiêu đề khi bạn nhập tiêu đề.'}
        </p>
      )}

      <div className="slug-field-actions">
        <button type="button" className="btn-secondary" onClick={() => setEditing((open) => !open)}>
          {editing ? 'Xong' : 'Sửa đường dẫn'}
        </button>
        {locked ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setLocked(false);
              onChange(slugify(sourceValue));
            }}
          >
            Tạo lại từ tiêu đề
          </button>
        ) : null}
      </div>

      <p className="slug-field-hint">
        Đây là địa chỉ bài viết trên website, không phải link của trang khác. Hệ thống tự tạo từ tiêu đề — bạn
        không cần nhập gì.
      </p>
    </div>
  );
}
