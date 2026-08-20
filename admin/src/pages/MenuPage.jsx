import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getNavigation, saveNavigation } from '../api/navigation.js';
import {
  buildTree,
  createRow,
  flattenTree,
  indentRow,
  moveBlock,
  outdentRow,
  removeRow,
} from '../lib/menu-tree.js';

// Các đường dẫn nội bộ thực sự tồn tại trên website. Dùng để cảnh báo mềm khi
// quản trị gõ một địa chỉ chưa có trang — không chặn lưu, vì trang mới có thể
// được thêm sau.
const KNOWN_PATHS = [
  '/',
  '/products',
  '/product-detail',
  '/projects',
  '/pricing',
  '/estimator',
  '/contact',
  '/news',
  '/tin-tuc',
];

function getUrlWarning(url) {
  const value = String(url || '').trim();
  if (!value || value.startsWith('#') || /^https?:\/\//i.test(value)) return '';
  const path = value.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
  if (KNOWN_PATHS.some((known) => path === known || path.startsWith(`${known}/`))) return '';
  return 'Đường dẫn này chưa có trang tương ứng, người xem sẽ gặp lỗi 404.';
}

export default function MenuPage() {
  const [rows, setRows] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dragIndex = useRef(null);

  useEffect(() => {
    setLoading(true);
    getNavigation()
      .then((items) => {
        const loaded = flattenTree(items);
        setRows(loaded);
        setSavedSnapshot(JSON.stringify(buildTree(loaded)));
      })
      .catch((err) => setError(err.message || 'Không tải được thanh menu.'))
      .finally(() => setLoading(false));
  }, []);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const dirty = JSON.stringify(tree) !== savedSnapshot;

  function update(next) {
    setRows(next);
    setNotice('');
  }

  function handleField(index, field, value) {
    const next = rows.slice();
    next[index] = { ...next[index], [field]: value };
    update(next);
  }

  function handleDrop(targetIndex) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === targetIndex) return;
    update(moveBlock(rows, from, targetIndex));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveNavigation(tree);
      const loaded = flattenTree(saved);
      setRows(loaded);
      setSavedSnapshot(JSON.stringify(buildTree(loaded)));
      setNotice('Đã lưu thanh menu. Tải lại website để xem thay đổi.');
    } catch (err) {
      setError(err.message || 'Không lưu được thanh menu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Thanh menu</h1>
        <p>Kéo thả để sắp xếp, sửa tên và đường dẫn, ẩn hoặc thêm mục mới cho thanh điều hướng trên website.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <>
          <ul className="menu-editor">
            {rows.map((row, index) => {
              const warning = getUrlWarning(row.url);
              return (
                <li
                  key={row.key}
                  className={`menu-row${row.depth > 0 ? ' is-child' : ''}${row.visible ? '' : ' is-hidden'}`}
                  draggable
                  onDragStart={() => { dragIndex.current = index; }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                >
                  <span className="menu-drag" aria-hidden="true">⠿</span>

                  <div className="menu-fields">
                    <label>
                      <span>Tên hiển thị</span>
                      <input
                        value={row.label}
                        onChange={(event) => handleField(index, 'label', event.target.value)}
                        maxLength={100}
                      />
                    </label>
                    <label>
                      <span>Đường dẫn</span>
                      <input
                        value={row.url}
                        onChange={(event) => handleField(index, 'url', event.target.value)}
                        maxLength={500}
                      />
                      {warning ? <small className="menu-warning">{warning}</small> : null}
                    </label>
                  </div>

                  <div className="menu-row-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      title="Chuyển thành mục con của mục ngay trên"
                      disabled={index === 0 || row.depth > 0}
                      onClick={() => update(indentRow(rows, index))}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      title="Đưa trở lại cấp 1"
                      disabled={row.depth === 0}
                      onClick={() => update(outdentRow(rows, index))}
                    >
                      ←
                    </button>
                    <label className="menu-visible">
                      <input
                        type="checkbox"
                        checked={row.visible}
                        onChange={(event) => handleField(index, 'visible', event.target.checked)}
                      />
                      <span>Hiện</span>
                    </label>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => update(removeRow(rows, index))}
                    >
                      Xoá
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => update([...rows, createRow()])}>
              Thêm mục
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Đang lưu...' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
