import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getNavigation, saveNavigation } from '../api/navigation.js';
import Icon from '../components/Icon.jsx';
import SaveBar from '../components/SaveBar.jsx';
import {
  buildTree,
  canMoveDown,
  canMoveUp,
  createRow,
  flattenTree,
  indentRow,
  moveBlock,
  moveDownRow,
  moveUpRow,
  outdentRow,
  removeRow,
} from '../lib/menu-tree.js';

// Các đường dẫn nội bộ thực sự tồn tại trên website. Dùng để gợi ý khi gõ và để
// cảnh báo mềm khi quản trị nhập một địa chỉ chưa có trang — không chặn lưu, vì
// trang mới có thể được thêm sau.
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
  const [savedRows, setSavedRows] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const rowRefs = useRef({});

  useEffect(() => {
    setLoading(true);
    getNavigation()
      .then((items) => {
        const loaded = flattenTree(items);
        setRows(loaded);
        setSavedRows(loaded);
        setSavedSnapshot(JSON.stringify(buildTree(loaded)));
      })
      .catch((err) => setError(err.message || 'Không tải được thanh menu.'))
      .finally(() => setLoading(false));
  }, []);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const dirty = JSON.stringify(tree) !== savedSnapshot;

  // Rời trang khi còn thay đổi chưa lưu là cách mất công sức phổ biến nhất ở
  // màn hình này, nên chặn lại bằng hộp thoại của trình duyệt.
  useEffect(() => {
    if (!dirty) return undefined;
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function update(next) {
    setRows(next);
    setNotice('');
  }

  function handleField(index, field, value) {
    const next = rows.slice();
    next[index] = { ...next[index], [field]: value };
    update(next);
  }

  // Sau khi đổi thứ tự, trả tiêu điểm về đúng mục vừa di chuyển để bấm liên tiếp
  // được bằng bàn phím.
  function moveAndFocus(nextRows, key, control) {
    update(nextRows);
    window.requestAnimationFrame(() => {
      rowRefs.current[`${key}:${control}`]?.focus();
    });
  }

  function handleDrop(targetIndex) {
    const from = dragIndex;
    setDragIndex(null);
    setDropIndex(null);
    if (from == null || from === targetIndex) return;
    update(moveBlock(rows, from, targetIndex));
  }

  function handleAdd() {
    const next = [...rows, createRow()];
    update(next);
    window.requestAnimationFrame(() => {
      rowRefs.current[`${next[next.length - 1].key}:label`]?.focus();
    });
  }

  function handleRemove(index) {
    const row = rows[index];
    const name = row.label?.trim() || 'mục chưa đặt tên';
    if (!window.confirm(`Xoá "${name}" khỏi thanh menu? Các mục con bên dưới cũng bị xoá.`)) return;
    update(removeRow(rows, index));
  }

  function handleReset() {
    if (!window.confirm('Bỏ mọi thay đổi và quay về bản đã lưu?')) return;
    setRows(savedRows);
    setNotice('');
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveNavigation(tree);
      const loaded = flattenTree(saved);
      setRows(loaded);
      setSavedRows(loaded);
      setSavedSnapshot(JSON.stringify(buildTree(loaded)));
      setNotice('Đã lưu thanh menu. Tải lại website để xem thay đổi.');
    } catch (err) {
      setError(err.message || 'Không lưu được thanh menu.');
    } finally {
      setSaving(false);
    }
  }

  const visibleTree = tree.filter((item) => item.visible !== false);

  return (
    <main className="page menu-page">
      <SaveBar
        title="Thanh menu"
        description="Sắp xếp các mục điều hướng hiện trên đầu website. Kéo thả hoặc dùng nút lên/xuống để đổi thứ tự, thụt vào để tạo mục con."
        saving={saving}
        disabled={!dirty}
        label="Lưu thay đổi"
        onSave={handleSave}
        onCancel={handleReset}
        cancelLabel="Hoàn tác"
        cancelDisabled={!dirty}
        status={
          <span className={`savebar-status${dirty ? ' is-dirty' : ''}`}>
            {dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}
          </span>
        }
      />

      {error ? <p className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</p> : null}
      {notice ? <p className="form-notice" role="status"><Icon name="check" size={16} /> {notice}</p> : null}

      {loading ? (
        <p className="menu-loading">Đang tải thanh menu...</p>
      ) : (
        <>
          <section className="menu-preview" aria-label="Xem trước thanh menu" data-tour="menu-preview">
            <p className="menu-preview-title">Khách sẽ thấy</p>
            {visibleTree.length ? (
              <ul className="menu-preview-bar">
                {visibleTree.map((item, index) => {
                  const children = (item.children || []).filter((child) => child.visible !== false);
                  return (
                    <li key={`${item.label}-${index}`}>
                      <span className="menu-preview-label">{item.label || 'Chưa đặt tên'}</span>
                      {children.length ? (
                        <span className="menu-preview-children">
                          {children.slice(0, 4).map((child, childIndex) => {
                            const label = child.label || 'Chưa đặt tên';
                            return (
                              <span key={`${label}-${childIndex}`} title={label}>{label}</span>
                            );
                          })}
                          {children.length > 4 ? (
                            <span title={children.slice(4).map((child) => child.label || 'Chưa đặt tên').join(', ')}>
                              +{children.length - 4}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="menu-preview-empty">Chưa có mục nào đang hiện.</p>
            )}
          </section>

          {rows.length === 0 ? (
            <div className="menu-empty">
              <p>Thanh menu đang trống.</p>
              <button type="button" className="btn-primary" onClick={handleAdd}>
                <Icon name="plus" size={17} /> Thêm mục đầu tiên
              </button>
            </div>
          ) : (
            <ul className="menu-editor">
              {rows.map((row, index) => {
                const warning = getUrlWarning(row.url);
                const isChild = row.depth > 0;
                const classes = [
                  'menu-row',
                  isChild ? 'is-child' : '',
                  row.visible ? '' : 'is-hidden',
                  dragIndex === index ? 'is-dragging' : '',
                  dropIndex === index && dragIndex !== index ? 'is-drop-target' : '',
                ].filter(Boolean).join(' ');

                return (
                  <li
                    key={row.key}
                    className={classes}
                    data-tour="menu-row"
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                    onDragOver={(event) => { event.preventDefault(); setDropIndex(index); }}
                    onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="menu-handle">
                      <span className="menu-drag" title="Kéo để đổi thứ tự" aria-hidden="true" data-tour="menu-drag">
                        <Icon name="grip" size={18} />
                      </span>
                      <div className="menu-move">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Đưa "${row.label || 'mục này'}" lên trên`}
                          title="Lên trên"
                          disabled={!canMoveUp(rows, index)}
                          ref={(node) => { rowRefs.current[`${row.key}:up`] = node; }}
                          onClick={() => moveAndFocus(moveUpRow(rows, index), row.key, 'up')}
                        >
                          <Icon name="up" size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Đưa "${row.label || 'mục này'}" xuống dưới`}
                          title="Xuống dưới"
                          disabled={!canMoveDown(rows, index)}
                          ref={(node) => { rowRefs.current[`${row.key}:down`] = node; }}
                          onClick={() => moveAndFocus(moveDownRow(rows, index), row.key, 'down')}
                        >
                          <Icon name="down" size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="menu-body">
                      <div className="menu-fields">
                        <label>
                          <span>Tên hiển thị</span>
                          <input
                            value={row.label}
                            placeholder="Ví dụ: Sản phẩm"
                            ref={(node) => { rowRefs.current[`${row.key}:label`] = node; }}
                            onChange={(event) => handleField(index, 'label', event.target.value)}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          <span>Đường dẫn</span>
                          <input
                            value={row.url}
                            list="menu-known-paths"
                            placeholder="/products hoặc https://..."
                            onChange={(event) => handleField(index, 'url', event.target.value)}
                            maxLength={500}
                          />
                        </label>
                      </div>
                      {warning ? (
                        <p className="menu-warning"><Icon name="alert" size={14} /> {warning}</p>
                      ) : null}
                    </div>

                    <div className="menu-row-actions" data-tour="menu-row-actions">
                      {isChild ? (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Đưa trở lại cấp 1"
                          aria-label={`Đưa "${row.label || 'mục này'}" trở lại cấp 1`}
                          onClick={() => update(outdentRow(rows, index))}
                        >
                          <Icon name="outdent" size={17} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Thành mục con của mục ngay trên"
                          aria-label={`Cho "${row.label || 'mục này'}" thành mục con`}
                          disabled={index === 0}
                          onClick={() => update(indentRow(rows, index))}
                        >
                          <Icon name="indent" size={17} />
                        </button>
                      )}

                      <button
                        type="button"
                        className={`icon-btn${row.visible ? '' : ' is-off'}`}
                        aria-pressed={!row.visible}
                        title={row.visible ? 'Đang hiện — bấm để ẩn' : 'Đang ẩn — bấm để hiện'}
                        aria-label={row.visible ? `Ẩn "${row.label || 'mục này'}"` : `Hiện "${row.label || 'mục này'}"`}
                        onClick={() => handleField(index, 'visible', !row.visible)}
                      >
                        <Icon name={row.visible ? 'eye' : 'eyeOff'} size={17} />
                      </button>

                      <button
                        type="button"
                        className="icon-btn is-danger"
                        title="Xoá mục"
                        aria-label={`Xoá "${row.label || 'mục này'}"`}
                        onClick={() => handleRemove(index)}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <datalist id="menu-known-paths">
            {KNOWN_PATHS.map((path) => <option key={path} value={path} />)}
          </datalist>

          {rows.length ? (
            <button type="button" className="menu-add" onClick={handleAdd} data-tour="menu-add">
              <Icon name="plus" size={17} /> Thêm mục
            </button>
          ) : null}

        </>
      )}
    </main>
  );
}
