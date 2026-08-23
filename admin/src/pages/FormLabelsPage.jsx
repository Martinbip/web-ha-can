import React, { useEffect, useMemo, useState } from 'react';
import { RESOURCE_CONFIG, setLabelOverrides } from '../config/resources.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import SaveBar from '../components/SaveBar.jsx';

const TYPE = 'site-setting';

const RESOURCE_OPTIONS = Object.entries(RESOURCE_CONFIG).map(([type, config]) => [type, config.label]);

// Chỉ những ô thật sự hiện ra cho biên tập viên mới cần đặt lại chữ.
function editableFieldEntries(type) {
  const config = RESOURCE_CONFIG[type];
  return Object.entries(config?.fields || {}).filter(([, field]) => field.type !== 'hidden');
}

function readOverride(overrides, type, name, key) {
  const value = overrides?.[type]?.[name]?.[key];
  return typeof value === 'string' ? value : '';
}

export default function FormLabelsPage() {
  const [recordId, setRecordId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [type, setType] = useState(RESOURCE_OPTIONS[0]?.[0] || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getSingletonResource(TYPE)
      .then((data) => {
        setRecordId(data ? data.documentId ?? data.id ?? null : null);
        const stored = data?.admin_labels;
        setOverrides(stored && typeof stored === 'object' ? stored : {});
      })
      .catch((err) => setError(err.message || 'Không tải được chữ trong form.'))
      .finally(() => setLoading(false));
  }, []);

  const fields = useMemo(() => editableFieldEntries(type), [type]);

  function updateOverride(name, key, value) {
    setNotice('');
    setOverrides((prev) => {
      const forType = { ...(prev[type] || {}) };
      const forField = { ...(forType[name] || {}), [key]: value };
      // Bỏ hẳn khoá rỗng để dữ liệu lưu chỉ còn phần quản trị thực sự đã sửa.
      if (!value) delete forField[key];
      if (Object.keys(forField).length) forType[name] = forField;
      else delete forType[name];
      const next = { ...prev };
      if (Object.keys(forType).length) next[type] = forType;
      else delete next[type];
      return next;
    });
  }

  function resetCurrentResource() {
    setNotice('');
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!recordId) {
      setError('Không tìm thấy bản ghi cài đặt để lưu.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveSingletonResource(TYPE, recordId, { admin_labels: overrides });
      // Áp dụng ngay cho các form đang mở trong phiên này, khỏi phải tải lại trang.
      setLabelOverrides(overrides);
      setNotice('Đã lưu chữ hiển thị trong form quản trị.');
    } catch (err) {
      setError(err.message || 'Không lưu được chữ trong form.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Chữ trong form quản trị</h1>
        <p>
          Đổi tên ô nhập và câu hướng dẫn hiện trong các form quản trị. Bỏ trống là dùng lại
          chữ mặc định ghi mờ trong ô.
        </p>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form className="edit-form" onSubmit={handleSubmit}>
          <SaveBar
            saving={saving}
            onCancel={resetCurrentResource}
            cancelLabel="Trả form này về chữ mặc định"
          />
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          <div className="field-row">
            <label htmlFor="label-resource">Form cần sửa</label>
            <select
              id="label-resource"
              value={type}
              onChange={(event) => {
                setNotice('');
                setType(event.target.value);
              }}
            >
              {RESOURCE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="label-editor">
            {fields.map(([name, field]) => (
              <div className="label-editor-row" key={name}>
                <p className="label-editor-field">{name}</p>
                <div className="label-editor-inputs">
                  <input
                    type="text"
                    aria-label={`Tên ô ${field.label || name}`}
                    placeholder={field.label || name}
                    value={readOverride(overrides, type, name, 'label')}
                    onChange={(event) => updateOverride(name, 'label', event.target.value)}
                  />
                  <input
                    type="text"
                    aria-label={`Câu hướng dẫn cho ${field.label || name}`}
                    placeholder={field.hint || 'Câu hướng dẫn (không bắt buộc)'}
                    value={readOverride(overrides, type, name, 'hint')}
                    onChange={(event) => updateOverride(name, 'hint', event.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

        </form>
      )}
    </main>
  );
}
