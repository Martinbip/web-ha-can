import React, { useEffect, useState } from 'react';
import { PAGE_TABS, SEO_TAB_FIELDS } from '../config/page-content-fields.js';
import { getSingletonResource, saveSingletonResource } from '../api/resources.js';
import FieldRenderer from '../components/FieldRenderer.jsx';
import SaveBar from '../components/SaveBar.jsx';

const TYPE = 'page-content';

// Chữ và SEO của từng trang gộp trong một bản ghi duy nhất: texts[mã trang][khoá],
// seo[mã trang][khoá]. Đổi tab chỉ đổi phần hiện ra, `values` luôn giữ đủ cả 7 trang
// để lưu không làm mất dữ liệu của trang khác.
export default function PageContentPage() {
  const [recordId, setRecordId] = useState(null);
  const [values, setValues] = useState({ texts: {}, seo: {} });
  const [activeTab, setActiveTab] = useState(PAGE_TABS[0].code);
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
        setValues({ texts: data?.texts || {}, seo: data?.seo || {} });
      })
      .catch((err) => setError(err.message || 'Không tải được nội dung trang.'))
      .finally(() => setLoading(false));
  }, []);

  function handleTextChange(page, key, value) {
    setValues((prev) => ({
      ...prev,
      texts: { ...prev.texts, [page]: { ...prev.texts[page], [key]: value } },
    }));
  }

  function handleSeoChange(page, key, value) {
    setValues((prev) => ({
      ...prev,
      seo: { ...prev.seo, [page]: { ...prev.seo[page], [key]: value } },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveSingletonResource(TYPE, recordId, values);
      if (!recordId && saved?.data) setRecordId(saved.data.documentId ?? saved.data.id ?? null);
      setNotice('Đã lưu nội dung trang.');
    } catch (err) {
      setError(err.message || 'Không lưu được nội dung trang.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <SaveBar
        title="Nội dung trang"
        description="Bỏ trống ô nào thì website dùng lại chữ mặc định của ô đó."
        formId="edit-form"
        saving={saving}
      />

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <form id="edit-form" className="edit-form" onSubmit={handleSubmit}>
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          <div className="page-tabs" data-tour="page-content-tabs">
            {PAGE_TABS.map((tab) => (
              <button
                key={tab.code}
                type="button"
                className={`page-tab${activeTab === tab.code ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.code)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {PAGE_TABS.filter((tab) => tab.code === activeTab).map((tab) => (
            <div key={tab.code}>
              <div className="page-heading">
                <h2>Nội dung</h2>
              </div>
              <div className="field-grid">
                {tab.fields.map((field) => (
                  <div className="field-wrap" data-field={field.key} key={field.key}>
                    <FieldRenderer
                      name={`${tab.code}-${field.key}`}
                      field={field}
                      value={values.texts[tab.code]?.[field.key]}
                      values={values.texts[tab.code]}
                      onChange={(value) => handleTextChange(tab.code, field.key, value)}
                      setField={(name, value) => handleTextChange(tab.code, name, value)}
                    />
                  </div>
                ))}
              </div>

              <div className="page-heading">
                <h2>SEO</h2>
              </div>
              <div className="field-grid">
                {SEO_TAB_FIELDS.map((field) => (
                  <div className="field-wrap" data-field={field.key} key={field.key}>
                    <FieldRenderer
                      name={`${tab.code}-seo-${field.key}`}
                      field={field}
                      value={values.seo[tab.code]?.[field.key]}
                      values={values.seo[tab.code]}
                      onChange={(value) => handleSeoChange(tab.code, field.key, value)}
                      setField={(name, value) => handleSeoChange(tab.code, name, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </form>
      )}
    </main>
  );
}
