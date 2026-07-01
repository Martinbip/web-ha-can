import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getResourceConfig } from '../config/resources.js';
import { createResource, getResource, saveResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';

export default function ResourceEditPage({ mode }) {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const config = getResourceConfig(type);
  const isNew = mode === 'new';

  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew || !config) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    getResource(type, id)
      .then((payload) => setValues(payload.data || {}))
      .catch((err) => setError(err.message || 'Không tải được dữ liệu.'))
      .finally(() => setLoading(false));
  }, [type, id, isNew, config]);

  if (!config) {
    return (
      <main className="page">
        <div className="page-heading">
          <h1>Không tìm thấy module</h1>
        </div>
      </main>
    );
  }

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await createResource(type, values);
      } else {
        await saveResource(type, id, values);
      }
      navigate(`/resources/${type}`);
    } catch (err) {
      setError(err.message || 'Không lưu được dữ liệu.');
    } finally {
      setSaving(false);
    }
  }

  const fieldEntries = Object.entries(config.fields || {});

  return (
    <main className="page">
      <div className="page-heading">
        <h1>{isNew ? `Thêm ${config.label}` : `Sửa ${config.label}`}</h1>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="field-grid">
            {fieldEntries.map(([name, field]) => (
              <FieldRenderer
                key={name}
                name={name}
                field={field}
                value={values[name]}
                onChange={(value) => handleChange(name, value)}
              />
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/resources/${type}`)}>
              Hủy
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
