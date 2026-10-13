import React from 'react';
import { analyzeSeo, DESCRIPTION_LIMIT, TITLE_LIMIT } from '../lib/seo.js';

// Xem trước kết quả Google và danh sách kiểm SEO, tính lại theo từng chữ đang
// gõ trong form. Chỉ để gợi ý: không chặn lưu.
export default function SeoPanel({ id, values, previewBase = '', kind = 'article' }) {
  const { title, description, checks, score } = analyzeSeo(values, { kind });
  const url = `${previewBase}${(kind === 'product' ? values.uid : values.slug) || ''}`;
  const level = score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad';

  return (
    <div className="seo-panel" id={id}>
      <div className="seo-preview" aria-label="Xem trước trên Google">
        <p className="seo-preview-url">{url.replace(/^https?:\/\//, '')}</p>
        <p className="seo-preview-title">{truncate(title, TITLE_LIMIT) || 'Tiêu đề bài viết'}</p>
        <p className="seo-preview-desc">{truncate(description, DESCRIPTION_LIMIT) || 'Mô tả bài viết sẽ hiện ở đây.'}</p>
      </div>

      <div className={`seo-score seo-${level}`}>
        Điểm SEO: <strong>{score}/100</strong>
      </div>
      <ul className="seo-checks">
        {checks.map((check) => (
          <li key={check.id} className={`seo-${check.status}`}>
            <span aria-hidden="true">{check.status === 'good' ? '✓' : check.status === 'warn' ? '!' : '✕'}</span>
            {check.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Google cắt tiêu đề/mô tả dài bằng dấu "…" — xem trước cắt y như vậy để biên
// tập viên thấy chữ nào bị mất.
function truncate(text, limit) {
  const value = String(text || '');
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

export function CountedInput({ id, value, onChange, multiline = false, limit, placeholder }) {
  const length = String(value || '').length;
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className="counted-input">
      <Tag
        id={id}
        type={multiline ? undefined : 'text'}
        rows={multiline ? 3 : undefined}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {limit ? (
        <span className={`counted-input-count${length > limit ? ' is-over' : ''}`}>
          {length}/{limit}
        </span>
      ) : null}
    </div>
  );
}
