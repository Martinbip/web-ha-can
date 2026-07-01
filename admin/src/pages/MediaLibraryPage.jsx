import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_FOLDERS, deleteMedia, listMedia, uploadMedia } from '../api/media.js';

// Cloudinary-backed media library. Everything goes through /api/admin-ui/media
// (see admin/src/api/media.js) — the frontend never talks to Cloudinary
// directly and never sees an API secret.
export default function MediaLibraryPage() {
  const [folder, setFolder] = useState(MEDIA_FOLDERS[0]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback((prefix) => {
    setLoading(true);
    setError('');
    listMedia({ prefix })
      .then((payload) => setAssets(Array.isArray(payload.data) ? payload.data : []))
      .catch((err) => setError(err.message || 'Không tải được thư viện ảnh.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(folder);
  }, [folder, load]);

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Vui lòng chọn ảnh để tải lên.');
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadMedia(file, folder);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice('Tải ảnh lên thành công.');
      load(folder);
    } catch (err) {
      setError(err.message || 'Tải ảnh lên thất bại.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCopyUrl(asset) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(asset.secure_url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = asset.secure_url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setNotice('Đã sao chép URL ảnh.');
    } catch (err) {
      setError('Không sao chép được URL.');
    }
  }

  async function handleDelete(asset) {
    if (!window.confirm(`Xóa ảnh "${asset.public_id}"? Hành động này không thể hoàn tác.`)) return;
    setBusyId(asset.public_id);
    setError('');
    setNotice('');
    try {
      await deleteMedia(asset.public_id);
      setNotice('Đã xóa ảnh.');
      load(folder);
    } catch (err) {
      if (err.code === 'MEDIA_IN_USE') {
        const references = err.details?.references || [];
        const list = references
          .map((ref) => `${ref.label || ref.type}: ${ref.title || ref.documentId}`)
          .join(', ');
        setError(`Ảnh đang được dùng ở: ${list || 'một số nội dung khác'}. Vui lòng gỡ khỏi các nội dung đó trước khi xóa.`);
      } else {
        setError(err.message || 'Không xóa được ảnh.');
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Thư viện ảnh</h1>
        <p>Quản lý ảnh Cloudinary dùng cho website (tải lên, sao chép URL, xóa).</p>
      </div>

      <form className="media-upload-form" onSubmit={handleUpload}>
        <label>
          Thư mục
          <select value={folder} onChange={(event) => setFolder(event.target.value)}>
            {MEDIA_FOLDERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chọn ảnh
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        </label>
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="media-grid">
          {assets.length === 0 ? (
            <p>Chưa có ảnh nào trong thư mục này.</p>
          ) : (
            assets.map((asset) => (
              <div className="media-card" key={asset.public_id}>
                <img src={asset.secure_url} alt={asset.public_id} />
                <p className="media-card-name" title={asset.public_id}>
                  {asset.public_id}
                </p>
                <div className="media-card-actions">
                  <button type="button" className="btn-secondary" onClick={() => handleCopyUrl(asset)}>
                    Sao chép URL
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === asset.public_id}
                    onClick={() => handleDelete(asset)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
