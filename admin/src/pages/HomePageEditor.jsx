import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getResourceConfig } from '../config/resources.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';
import SaveBar from '../components/SaveBar.jsx';

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
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveSingletonResource(TYPE, recordId, values);
      // Lần lưu đầu tiên là tạo mới: nhớ lại mã bản ghi cho những lần lưu sau.
      if (!recordId && saved?.data) setRecordId(saved.data.documentId ?? saved.data.id ?? null);
      setNotice('Đã lưu nội dung trang chủ.');
    } catch (err) {
      setError(err.message || 'Không lưu được nội dung trang chủ.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <SaveBar
        title="Trang chủ"
        description="Quản lý slide, thẻ dịch vụ, bước quy trình và nội dung giới thiệu hiển thị trên trang chủ."
        formId="edit-form"
        saving={saving}
      />

      {/* Mỗi thẻ ứng với một khối trên trang chủ — ghi rõ tên khối để biên tập
          viên khỏi phải đoán "workflow-steps" là cái gì. */}
      <section className="card-grid" data-tour="home-cards">
        <article className="card">
          <h2>Slide đầu trang</h2>
          <p>Các ảnh chạy ở bên phải khối "Kim Loại Màu DHA" đầu trang chủ.</p>
          <Link className="btn-primary" to="/resources/hero-slides">
            Quản lý slide
          </Link>
        </article>
        <article className="card" data-tour="home-services">
          <h2>Thẻ dịch vụ</h2>
          <p>Ba thẻ trong khối "Khoáng sản &amp; dịch vụ địa chất": tiêu đề, mô tả, các dòng có dấu ✓ và nút bên dưới.</p>
          <Link className="btn-primary" to="/resources/services">
            Quản lý dịch vụ
          </Link>
        </article>
        <article className="card" data-tour="home-workflow">
          <h2>Bước quy trình</h2>
          <p>Các ô đánh số 01, 02… trong khối "Quy trình thu thập &amp; kiểm định mẫu".</p>
          <Link className="btn-primary" to="/resources/workflow-steps">
            Quản lý bước quy trình
          </Link>
        </article>
        <article className="card" data-tour="home-headings">
          <h2>Tiêu đề các khối</h2>
          <p>Nhãn nhỏ màu vàng, tiêu đề lớn và câu mô tả của khối Dịch vụ, Quy trình, Sản phẩm, Tin tức… nằm ở Nội dung trang, thẻ Trang chủ.</p>
          <Link className="btn-primary" to="/page-content">
            Mở Nội dung trang
          </Link>
        </article>
        <article className="card">
          <h2>Hai nút ở đầu trang</h2>
          <p>Chữ và link của nút "Xem Danh Mục Quặng" và "Tính Giá Nhanh" cũng nằm ở Nội dung trang, thẻ Trang chủ.</p>
          <Link className="btn-primary" to="/page-content">
            Mở Nội dung trang
          </Link>
        </article>
      </section>

      <div className="page-heading">
        <h2>Nội dung giới thiệu &amp; số liệu (site-setting)</h2>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form id="edit-form" className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
          <div className="field-grid" data-tour="edit-fields">
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
        </form>
      )}
    </main>
  );
}
