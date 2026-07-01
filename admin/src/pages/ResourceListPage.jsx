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

  const load = useCallback(
    (page = 1) => {
      if (!config) return;
      setLoading(true);
      setError('');
      const params = { page };
      if (search) params.search = search;
      listResources(type, params)
        .then((payload) => {
          const data = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
          setRows(data);
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
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              aria-label="Tìm kiếm"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit">Tìm</button>
          </form>
          {!config.readOnlyCreate ? (
            <Link className="btn-primary" to={`/resources/${type}/new`}>
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
          <table className="data-table">
            <thead>
              <tr>
                {listFields.map((field) => (
                  <th key={field}>{config.fields?.[field]?.label || field}</th>
                ))}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={listFields.length + 1}>Chưa có dữ liệu.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const id = row.documentId ?? row.id;
                  return (
                    <tr key={id}>
                      {listFields.map((field) => (
                        <td key={field}>{formatCell(row[field])}</td>
                      ))}
                      <td className="table-actions">
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
        <div className="pagination">
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

function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
