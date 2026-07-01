import React from 'react';

// Minimal rich text abstraction: a plain textarea storing HTML/markdown source.
// This keeps the field's public contract (value/onChange of a string) stable so a
// future WYSIWYG editor can replace the internals without touching FieldRenderer
// or any resource config.
export default function RichTextField({ id, value, onChange, required }) {
  return (
    <textarea
      id={id}
      className="richtext-field"
      rows={10}
      value={value || ''}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Nhập nội dung (hỗ trợ HTML cơ bản)..."
    />
  );
}
