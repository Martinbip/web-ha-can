import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_FOLDERS, getLegacyFolder, listMedia, uploadMedia } from '../api/media.js';

// Real Cloudinary-backed picker: shows the current image, and an inline
// expandable panel to browse existing media or upload a new one. Keeps the
// value/onChange contract FieldRenderer already relies on (value = the
// stored secure_url string, onChange(url) updates the field), and additionally
// calls onSelect(asset) with the full Cloudinary asset when one is chosen, so
// callers that need more than the URL (e.g. public_id) can use it too.
export default function ImagePicker({ id, value, onChange, onSelect, folder, showPreview = true }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const activeFolder = folder || MEDIA_FOLDERS[0];

  // Images uploaded before the rebrand still live under ha-can/, including the
  // ones the current content points at — list that folder alongside the dha/
  // one so an existing image can be picked again, not just re-uploaded. One
  // folder failing (or simply being empty) must not blank out the other, so
  // each request settles on its own.
  const load = useCallback(() => {
    setLoading(true);
    setError('');

    const folders = [activeFolder, getLegacyFolder(activeFolder)].filter(Boolean);

    Promise.all(
      folders.map((prefix) =>
        listMedia({ prefix })
          .then((payload) => (Array.isArray(payload.data) ? payload.data : []))
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (results.every((result) => result === null)) {
          setError('Không tải được thư viện ảnh.');
          setAssets([]);
          return;
        }
        setAssets(results.filter(Boolean).flat());
      })
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

  async function handleUpload() {
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
      {/* Khi picker được dùng để chèn ảnh vào giữa bài viết thì không có "ảnh
          hiện tại" nào để xem trước — ảnh đi thẳng vào nội dung. */}
      {showPreview ? (
        value ? (
          <div className="image-picker-preview">
            <img src={value} alt="" />
          </div>
        ) : (
          <p className="image-picker-hint">Chưa chọn ảnh.</p>
        )
      ) : null}

      {/* Uploading is the common case, so it stays visible instead of hiding
          behind the library toggle. Deliberately a plain div, not a form: this
          picker renders inside the edit page's own form element, and nested
          forms are invalid HTML — the browser drops the inner one, so a submit
          button here would submit the edit form and reload the page instead of
          uploading. */}
      <div className="image-picker-upload">
        <input ref={fileInputRef} id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        <button type="button" className="btn-primary" disabled={uploading} onClick={handleUpload}>
          {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
        </button>
      </div>

      <div className="image-picker-actions">
        <button type="button" className="btn-secondary" onClick={() => setOpen((prev) => !prev)}>
          {open ? 'Đóng thư viện ảnh' : 'Chọn ảnh có sẵn'}
        </button>
      </div>

      {folder ? <p className="image-picker-hint">Thư mục: {folder}</p> : null}

      {error ? <p className="form-error">{error}</p> : null}

      {open ? (
        <div className="image-picker-panel">
          {loading ? (
            <p>Đang tải...</p>
          ) : (
            <div className="image-picker-grid">
              {assets.length === 0 ? (
                <p>Chưa có ảnh nào để chọn. Hãy tải ảnh mới lên.</p>
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
