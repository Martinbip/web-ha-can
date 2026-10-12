import React, { useEffect, useState } from 'react';
import { getResourceConfig } from '../config/resources.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';
import SaveBar from '../components/SaveBar.jsx';

const TYPE = 'form-config';

// Option và con số của form Dự toán. Quặng và đơn giá không nằm ở đây: chúng là
// sản phẩm có giá theo kg (mục Sản phẩm), nhóm theo Danh mục sản phẩm.
const ESTIMATOR_FIELDS = [
  'packaging',
  'co_label',
  'co_price',
  'bulk_threshold_kg',
  'bulk_discount_percent',
  'no_analysis_label',
];

const CONTACT_FIELDS = ['contact_services'];

const ALL_FIELDS = [...ESTIMATOR_FIELDS, ...CONTACT_FIELDS];

export default function FormConfigPage() {
  const config = getResourceConfig(TYPE);
  const [recordId, setRecordId] = useState(null);
  const [values, setValues] = useState({});
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
        setValues(data || {});
      })
      .catch((err) => setError(err.message || 'Không tải được cấu hình Dự toán & Liên hệ.'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = Object.fromEntries(ALL_FIELDS.map((name) => [name, values[name] ?? null]));
      const saved = await saveSingletonResource(TYPE, recordId, payload);
      if (!recordId && saved?.data) setRecordId(saved.data.documentId ?? saved.data.id ?? null);
      // CMS bỏ dòng hỏng khi lưu: hiện lại đúng bản đã lưu để quản trị thấy.
      if (saved?.data) setValues(saved.data);
      setNotice('Đã lưu. Website cập nhật sau vài giây.');
    } catch (err) {
      setError(err.message || 'Không lưu được cấu hình Dự toán & Liên hệ.');
    } finally {
      setSaving(false);
    }
  }

  function renderFields(names) {
    return names.map((name) => (
      <FieldRenderer
        key={name}
        name={name}
        field={config.fields[name]}
        value={values[name]}
        values={values}
        onChange={(value) => handleChange(name, value)}
        setField={handleChange}
      />
    ));
  }

  return (
    <main className="page">
      <SaveBar
        title="Dự toán & Liên hệ"
        description="Lựa chọn và con số của form Dự toán, danh sách Nhu cầu của form Liên hệ. Bỏ trống ô nào thì website dùng giá trị mặc định của ô đó."
        formId="edit-form"
        saving={saving}
      />

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form id="edit-form" className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          <div className="page-heading">
            <h2>Form Dự toán</h2>
            <p>
              Ô "Nhóm khoáng sản" là các danh mục sản phẩm đang hiện; ô "Loại quặng" là các sản phẩm có giá
              tính theo kg trong danh mục đó. Sửa giá quặng ở mục Sản phẩm.
            </p>
          </div>
          <div className="field-grid" data-tour="form-config-estimator">
            {renderFields(ESTIMATOR_FIELDS)}
          </div>

          <div className="page-heading">
            <h2>Form Liên hệ</h2>
          </div>
          <div className="field-grid" data-tour="form-config-contact">
            {renderFields(CONTACT_FIELDS)}
          </div>
        </form>
      )}
    </main>
  );
}
