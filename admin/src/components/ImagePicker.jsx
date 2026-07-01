import React from 'react';

// Minimal stand-in for the Cloudinary media picker (Task 8 will replace this with a
// real upload/browse UI backed by /admin-ui/media). For now this is a plain URL
// input that previews the current image, keeping the same value/onChange contract
// so FieldRenderer and resource configs don't need to change later.
export default function ImagePicker({ id, value, onChange, folder }) {
  return (
    <div className="image-picker">
      {value ? (
        <div className="image-picker-preview">
          <img src={value} alt="" />
        </div>
      ) : null}
      <input
        id={id}
        type="text"
        value={value || ''}
        placeholder="Dán URL ảnh (Cloudinary)..."
        onChange={(event) => onChange(event.target.value)}
      />
      {folder ? <p className="image-picker-hint">Thư mục: {folder}</p> : null}
    </div>
  );
}
