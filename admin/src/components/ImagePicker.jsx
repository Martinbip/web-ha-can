import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_FOLDERS, listMedia, uploadMedia } from '../api/media.js';

// Real Cloudinary-backed picker: shows the current image, and an inline
// expandable panel to browse existing media or upload a new one. Keeps the
// value/onChange contract FieldRenderer already relies on (value = the
// stored secure_url string, onChange(url) updates the field), and additionally
// calls onSelect(asset) with the full Cloudinary asset when one is chosen, so
// callers that need more than the URL (e.g. public_id) can use it too.
export default function ImagePicker({ id, value, onChange, onSelect, folder }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const activeFolder = folder || MEDIA_FOLDERS[0];

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    listMedia({ prefix: activeFolder })
      .then((payload) => setAssets(Array.isArray(payload.data) ? payload.data : []))
      .catch((err) => setError(err.message || 'Không tải được thư viện ảnh.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function chooseAsset(asset) {
    onChange(asset.secure_url);
    if (onSelect) onSelect(asset);
    setOpen(false);
  }

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Vui lòng chọn ảnh để tải lên.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const payload = await uploadMedia(file, activeFolder);
      if (fileInputRef.current) fileInputRef.current.value = '';
      chooseAsset(payload.data);
    } catch (err) {
      setError(err.message || 'Tải ảnh lên thất bại.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-picker">
      {value ? (
        <div className="image-picker-preview">
          <img src={value} alt="" />
        </div>
      ) : (
        <p className="image-picker-hint">Chưa chọn ảnh.</p>
      )}

      <div className="image-picker-actions">
        <button type="button" className="btn-secondary" onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Đóng thư viện ảnh' : 'Chọn ảnh từ thư viện'}
        </button>
      </div>

      {folder ? <p className="image-picker-hint">Thư mục: {folder}</p> : null}

      {open ? (
        <div className="image-picker-panel">
          <form className="image-picker-upload" onSubmit={handleUpload}>
            <input ref={fileInputRef} id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? 'Đang tải lên...' : 'Tải lên & chọn'}
            </button>
          </form>

          {error ? <p className="form-error">{error}</p> : null}

          {loading ? (
            <p>Đang tải...</p>
          ) : (
            <div className="image-picker-grid">
              {assets.length === 0 ? (
                <p>Chưa có ảnh nào trong thư mục này.</p>
              ) : (
                assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.public_id}
                    className="image-picker-grid-item"
                    onClick={() => chooseAsset(asset)}
                    title={asset.public_id}
                  >
                    <img src={asset.secure_url} alt={asset.public_id} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
