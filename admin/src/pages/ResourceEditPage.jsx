import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getResourceConfig } from '../config/resources.js';
import { createResource, getResource, saveResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';
import SaveBar from '../components/SaveBar.jsx';
import { slugify } from '../lib/slug.js';

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

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleChange(field, value) {
    setField(field, value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = withClearedFields(config, withGeneratedSlugs(config, values));
      if (isNew) {
        await createResource(type, payload);
      } else {
        await saveResource(type, id, payload);
      }
      navigate(`/resources/${type}`);
    } catch (err) {
      setError(err.message || 'Không lưu được dữ liệu.');
    } finally {
      setSaving(false);
    }
  }

  const fieldEntries = Object.entries(config.fields || {});
  const visibleFields = fieldEntries.filter(([, field]) => isFieldVisible(field, values));

  return (
    <main className="page">
      <SaveBar
        title={isNew ? `Thêm ${config.label}` : `Sửa ${config.label}`}
        formId="edit-form"
        saving={saving}
        onCancel={() => navigate(`/resources/${type}`)}
      />

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form id="edit-form" className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="field-grid" data-tour="edit-fields">
            {visibleFields.map(([name, field]) => (
              <FieldRenderer
                key={name}
                name={name}
                field={field}
                value={values[name]}
                values={values}
                onChange={(value) => handleChange(name, value)}
                setField={setField}
              />
            ))}
          </div>
        </form>
      )}
    </main>
  );
}

// Bật một công tắc kiểu "giá liên hệ" thì các ô nó thay thế phải rỗng theo, nếu
// không con số cũ vẫn nằm lại trong dữ liệu và lộ ra ở bảng danh sách. Chỉ dọn
// lúc lưu, chứ không dọn ngay lúc tick: tick nhầm rồi bỏ tick vẫn còn giá cũ.
export function withClearedFields(config, values) {
  return Object.entries(config.fields || {}).reduce((data, [name, field]) => {
    if (!field.clearFields || !data[name]) return data;
    return { ...data, ...Object.fromEntries(field.clearFields.map((target) => [target, null])) };
  }, values);
}

// Vài trường chỉ có nghĩa khi một công tắc khác đang bật (hoặc đang tắt). Ẩn hẳn
// chúng đi thay vì để biên tập viên điền vào ô không có tác dụng.
function isFieldVisible(field, values) {
  if (field.showWhen && !values[field.showWhen]) return false;
  if (field.hideWhen && values[field.hideWhen]) return false;
  return true;
}

// Lưới an toàn cho trường đường dẫn: nếu vì lý do nào đó slug vẫn rỗng (ví dụ
// tiêu đề được dán vào trước khi trường slug kịp đồng bộ), sinh lại từ tiêu đề
// thay vì để Strapi trả về lỗi bắt buộc mà biên tập viên không hiểu.
export function withGeneratedSlugs(config, values) {
  const entries = Object.entries(config.fields || {});
  return entries.reduce((data, [name, field]) => {
    if (field.type !== 'slug' || data[name]) return data;
    const generated = slugify(data[field.sourceField]);
    return generated ? { ...data, [name]: generated } : data;
  }, values);
}
