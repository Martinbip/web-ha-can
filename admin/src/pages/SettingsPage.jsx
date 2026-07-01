import React, { useEffect, useState } from 'react';
import { getResourceConfig } from '../config/resources.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';

const TYPE = 'site-setting';

// General site-wide contact/branding fields. Homepage-specific hero/stat fields for
// this same site-setting record are edited on HomePageEditor instead, so a save here
// only sends this subset of fields.
const GENERAL_FIELDS = [
  'hotline',
  'hotline2',
  'email',
  'address',
  'office_name',
  'tax_code',
  'facebook_url',
  'youtube_url',
  'zalo_url',
  'twitter_url',
];

export default function SettingsPage() {
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
      .catch((err) => setError(err.message || 'Không tải được cài đặt.'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
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
      await saveSingletonResource(TYPE, recordId, values);
      setNotice('Đã lưu cài đặt.');
    } catch (err) {
      setError(err.message || 'Không lưu được cài đặt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Cài đặt website</h1>
        <p>Thông tin liên hệ, thương hiệu chung hiển thị trên toàn bộ website.</p>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
          <div className="field-grid">
            {GENERAL_FIELDS.map((name) => (
              <FieldRenderer
                key={name}
                name={name}
                field={config.fields[name]}
                value={values[name]}
                onChange={(value) => handleChange(name, value)}
              />
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
