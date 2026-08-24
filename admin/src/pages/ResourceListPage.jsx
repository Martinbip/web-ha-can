import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getResourceConfig } from '../config/resources.js';
import { deleteResource, listResources, publishResource, unpublishResource } from '../api/resources.js';

export default function ResourceListPage() {
  const { type } = useParams();
  const config = getResourceConfig(type);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // `keepError`: sau một thao tác hỏng (ví dụ xoá hàng loạt dừng giữa chừng),
  // danh sách vẫn phải tải lại, nhưng xoá luôn thông báo lỗi thì người dùng chỉ
  // thấy vài mục còn sót mà không hiểu vì sao.
  const load = useCallback(
    (page = 1, { keepError = false } = {}) => {
      if (!config) return;
      setLoading(true);
      if (!keepError) setError('');
      const params = { page };
      if (search) params.search = search;
      listResources(type, params)
        .then((payload) => {
          const data = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
          setRows(data);
          setSelectedIds([]);
          setMeta(payload.meta || { page: 1, pageSize: data.length, total: data.length });
        })
        .catch((err) => setError(err.message || 'Không tải được dữ liệu.'))
        .finally(() => setLoading(false));
    },
    [type, search, config]
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (!config) {
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Không tìm thấy module</h1>
        </div>
      </main>
    );
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    load(1);
  }

  async function handleDelete(row) {
    const id = row.documentId ?? row.id;
    const title = config.titleField ? row[config.titleField] : id;
    if (!window.confirm(`Xóa "${title}"? Hành động này không thể hoàn tác.`)) return;
    setBusyId(id);
    try {
      await deleteResource(type, id);
      load(meta.page);
    } catch (err) {
      setError(err.message || 'Không xóa được.');
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.documentId ?? row.id)));
  }

  // Xoá từng dòng một khi dọn nhiều bản nháp trùng nhau là việc rất mệt, nên
  // danh sách cho chọn nhiều rồi xoá một lượt. Backend không có endpoint xoá
  // hàng loạt, nên gọi tuần tự và dừng lại ở lỗi đầu tiên để người dùng biết
  // chính xác mục nào chưa xoá được.
  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xóa ${selectedIds.length} mục đã chọn? Hành động này không thể hoàn tác.`)) return;
    setBulkDeleting(true);
    setError('');
    try {
      for (const id of selectedIds) {
        await deleteResource(type, id);
      }
      setSelectedIds([]);
      load(1);
    } catch (err) {
      setError(err.message || 'Không xóa được một số mục đã chọn.');
      load(1, { keepError: true });
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handlePublishToggle(row) {
    const id = row.documentId ?? row.id;
    setBusyId(id);
    try {
      if (row.publishedAt) {
        await unpublishResource(type, id);
      } else {
        await publishResource(type, id);
      }
      load(meta.page);
    } catch (err) {
      setError(err.message || 'Không cập nhật được trạng thái xuất bản.');
    } finally {
      setBusyId(null);
    }
  }

  const listFields = config.listFields || [];
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.pageSize || 20)));

  return (
    <main className="page">
      <div className="page-heading">
        <h1>{config.label}</h1>
        <div className="page-heading-actions">
          <form className="search-form" onSubmit={handleSearchSubmit} data-tour="list-search">
            <input
              aria-label="Tìm kiếm"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Tìm</button>
          </form>
          {!config.readOnlyCreate && selectedIds.length > 0 ? (
            <button type="button" className="btn-danger" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? 'Đang xóa...' : `Xóa ${selectedIds.length} mục đã chọn`}
            </button>
          ) : null}
          {!config.readOnlyCreate ? (
            <Link className="btn-primary" to={`/resources/${type}/new`} data-tour="list-create">
              + Thêm mới
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table" data-tour="list-table">
            <thead>
              <tr>
                {!config.readOnlyCreate ? (
                  <th className="table-select-cell" data-tour="list-select-all">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                ) : null}
                {listFields.map((field) => (
                  <th key={field}>{config.fields?.[field]?.label || field}</th>
                ))}
                {config.draftAndPublish ? <th>Trạng thái</th> : null}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={listFields.length + 1 + (config.draftAndPublish ? 1 : 0) + (config.readOnlyCreate ? 0 : 1)}>
                    Chưa có dữ liệu.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const id = row.documentId ?? row.id;
                  return (
                    <tr key={id} className={selectedIds.includes(id) ? 'is-selected' : undefined}>
                      {!config.readOnlyCreate ? (
                        <td className="table-select-cell">
                          <input
                            type="checkbox"
                            aria-label="Chọn mục này"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleSelected(id)}
                          />
                        </td>
                      ) : null}
                      {listFields.map((field) => (
                        <td key={field}>{formatCell(row[field], config.fields?.[field])}</td>
                      ))}
                      {config.draftAndPublish ? (
                        <td>
                          <span className={`status-pill ${row.publishedAt ? 'is-published' : 'is-draft'}`}>
                            {row.publishedAt ? 'Đã đăng' : 'Bản nháp'}
                          </span>
                        </td>
                      ) : null}
                      <td className="table-actions" data-tour="list-actions">
                        <Link to={`/resources/${type}/${id}`}>Sửa</Link>
                        {config.draftAndPublish ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busyId === id}
                            onClick={() => handlePublishToggle(row)}
                          >
                            {row.publishedAt ? 'Gỡ xuất bản' : 'Xuất bản'}
                          </button>
                        ) : null}
                        {!config.readOnlyCreate ? (
                          <button
                            type="button"
                            className="btn-danger"
                            disabled={busyId === id}
                            onClick={() => handleDelete(row)}
                          >
                            Xóa
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="pagination" data-tour="list-pagination">
          <button type="button" disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>
            Trước
          </button>
          <span>
            Trang {meta.page} / {totalPages}
          </span>
          <button type="button" disabled={meta.page >= totalPages} onClick={() => load(meta.page + 1)}>
            Sau
          </button>
        </div>
      ) : null}
    </main>
  );
}

function formatCell(value, fieldConfig) {
  // Ô số bỏ trống lưu thành null, nhưng dữ liệu cũ còn nhiều bản ghi mang số 0.
  // Cả hai đều nghĩa là "chưa có giá", nên hiện cùng một chữ thay thế.
  const isEmptyNumber = fieldConfig?.type === 'number' && value === 0;
  if (value === null || value === undefined || value === '' || isEmptyNumber) {
    return fieldConfig?.emptyText || (isEmptyNumber ? '0' : '');
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
