import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getResourceConfig } from '../config/resources.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';

const TYPE = 'site-setting';

// Homepage-specific hero/brand/stat fields on the shared site-setting record. General
// contact fields (hotline, email, address, ...) for this same record are edited on
// SettingsPage instead.
const HERO_FIELDS = [
  'hero_tagline',
  'hero_title',
  'hero_description',
  'hero_cert_label',
  'hero_cert_value',
  'brand_bio',
  'stat1_number',
  'stat1_label',
  'stat2_number',
  'stat2_label',
  'stat3_number',
  'stat3_label',
];

export default function HomePageEditor() {
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
      .catch((err) => setError(err.message || 'Không tải được nội dung trang chủ.'))
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
      setNotice('Đã lưu nội dung trang chủ.');
    } catch (err) {
      setError(err.message || 'Không lưu được nội dung trang chủ.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Trang chủ</h1>
        <p>Quản lý slide, quy trình và nội dung giới thiệu hiển thị trên trang chủ.</p>
      </div>

      <section className="card-grid">
        <article className="card">
          <h2>Slide trang chủ</h2>
          <p>Quản lý các slide banner hiển thị ở đầu trang chủ.</p>
          <Link className="btn-primary" to="/resources/hero-slides">
            Quản lý hero-slides
          </Link>
        </article>
        <article className="card">
          <h2>Bước quy trình</h2>
          <p>Quản lý các bước trong quy trình làm việc hiển thị trên trang chủ.</p>
          <Link className="btn-primary" to="/resources/workflow-steps">
            Quản lý workflow-steps
          </Link>
        </article>
      </section>

      <div className="page-heading">
        <h2>Nội dung giới thiệu &amp; số liệu (site-setting)</h2>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
          <div className="field-grid">
            {HERO_FIELDS.map((name) => (
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
