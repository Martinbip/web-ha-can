import React, { useEffect, useState } from 'react';
import RichTextField from './RichTextField.jsx';
import SlugField from './SlugField.jsx';
import ImagePicker from './ImagePicker.jsx';
import { listResources } from '../api/resources.js';

// Maps one field config entry (from RESOURCE_CONFIG) + its current value to the
// right input control. Keeps list/edit pages free of per-type branching: they just
// render <FieldRenderer field={...} value={...} onChange={...} /> for every field.
export default function FieldRenderer({ name, field, value, onChange, setField, values }) {
  const id = `field-${name}`;
  const label = field.label || name;

  // Checkbox đọc ngược so với các field khác: ô tick đứng trước, nhãn nằm cùng hàng.
  if (field.type === 'boolean') {
    return (
      <div className="field-row field-row-check" key={name}>
        <label className="check-row" htmlFor={id}>
          {renderInput({ id, field, value, onChange, setField, values })}
          <span>
            {label}
            {field.required ? <span className="field-required"> *</span> : null}
          </span>
        </label>
        {field.hint ? <p className="field-hint field-hint-check">{field.hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="field-row" key={name}>
      {field.type !== 'hidden' ? (
        <label htmlFor={id}>
          {label}
          {field.required ? <span className="field-required"> *</span> : null}
          {field.readOnly ? <span className="field-readonly-hint"> (chỉ đọc)</span> : null}
        </label>
      ) : null}
      {renderInput({ id, field, value, onChange, setField, values })}
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
    </div>
  );
}

function renderInput({ id, field, value, onChange, setField, values }) {
  switch (field.type) {
    case 'text':
      return (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          placeholder={field.placeholder}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'email':
      return (
        <input
          id={id}
          type="email"
          value={value ?? ''}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'url':
      return (
        <input
          id={id}
          type="url"
          value={value ?? ''}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'date':
      return (
        <input
          id={id}
          type="date"
          value={toDateInputValue(value)}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'number':
      return (
        <input
          id={id}
          type="number"
          value={value ?? ''}
          placeholder={field.placeholder}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
      );

    case 'textarea':
      return (
        <textarea
          id={id}
          rows={4}
          value={value ?? ''}
          placeholder={field.placeholder}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'richtext':
      return (
        <RichTextField
          id={id}
          value={value}
          onChange={onChange}
          imageFolder={field.imageFolder}
        />
      );

    case 'slug':
      return (
        <SlugField
          id={id}
          value={value}
          onChange={onChange}
          sourceValue={values?.[field.sourceField] || ''}
          previewBase={field.previewBase}
        />
      );

    case 'select':
      return (
        <select
          id={id}
          value={value ?? ''}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">-- Chọn --</option>
          {(field.options || []).map((option) => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? option.label : option;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      );

    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      );

    case 'multi-select':
      return <MultiSelectField id={id} value={value} onChange={onChange} field={field} />;

    case 'key-value-table':
      return <KeyValueTableField id={id} value={value} onChange={onChange} />;

    case 'text-list':
      return <TextListField id={id} value={value} onChange={onChange} />;

    case 'cloudinary-image':
      return (
        <ImagePicker
          id={id}
          value={value}
          onChange={onChange}
          onSelect={
            field.publicIdField && setField
              ? (asset) => setField(field.publicIdField, asset.public_id)
              : undefined
          }
          onClear={
            field.publicIdField && setField
              ? () => setField(field.publicIdField, '')
              : undefined
          }
          folder={field.folder}
        />
      );

    case 'hidden':
      return <input id={id} type="hidden" value={value ?? ''} readOnly />;

    default:
      return (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

function toDateInputValue(value) {
  if (!value) return '';
  const stringValue = String(value);
  return stringValue.length >= 10 ? stringValue.slice(0, 10) : stringValue;
}

function KeyValueTableField({ id, value, onChange }) {
  const entries = toEntries(value);

  function updateEntry(index, key, val) {
    const next = entries.slice();
    next[index] = [key, val];
    onChange(fromEntries(next));
  }

  function removeEntry(index) {
    const next = entries.slice();
    next.splice(index, 1);
    onChange(fromEntries(next));
  }

  function addEntry() {
    onChange(fromEntries([...entries, ['', '']]));
  }

  return (
    <div className="kv-table" id={id}>
      {entries.map(([key, val], index) => (
        <div className="kv-row" key={index}>
          <input
            type="text"
            placeholder="Tên thông số"
            value={key}
            onChange={(event) => updateEntry(index, event.target.value, val)}
          />
          <input
            type="text"
            placeholder="Giá trị"
            value={val}
            onChange={(event) => updateEntry(index, key, event.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => removeEntry(index)}>
            Xóa
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addEntry}>
        + Thêm dòng
      </button>
    </div>
  );
}

function toEntries(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).map(([key, val]) => [key, val == null ? '' : String(val)]);
}

function fromEntries(entries) {
  return entries.reduce((acc, [key, val]) => {
    if (key) acc[key] = val;
    return acc;
  }, {});
}

function TextListField({ id, value, onChange }) {
  const items = Array.isArray(value) ? value : [];

  function updateItem(index, val) {
    const next = items.slice();
    next[index] = val;
    onChange(next);
  }

  function removeItem(index) {
    const next = items.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function addItem() {
    onChange([...items, '']);
  }

  return (
    <div className="text-list" id={id}>
      {items.map((item, index) => (
        <div className="text-list-row" key={index}>
          <input
            type="text"
            value={item}
            onChange={(event) => updateItem(index, event.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => removeItem(index)}>
            Xóa
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addItem}>
        + Thêm dòng
      </button>
    </div>
  );
}

// Ô tick nhiều lựa chọn, danh sách lấy động từ một collection khác (field.optionsFrom).
// Giá trị lưu là mảng mã (slug) chứ không phải id, để website đọc thẳng không cần
// nối bảng. Mục nào đã gán nhưng không còn trong danh sách vẫn hiện, kèm ghi chú,
// để quản trị thấy và tự gỡ thay vì âm thầm mất dữ liệu.
function MultiSelectField({ id, value, onChange, field }) {
  const [options, setOptions] = useState([]);
  const [state, setState] = useState('loading');
  const selected = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

  useEffect(() => {
    let cancelled = false;
    if (!field.optionsFrom) {
      setOptions((field.options || []).map(toOption));
      setState('ready');
      return undefined;
    }
    listResources(field.optionsFrom, { pageSize: 100, sort: 'sort_order:asc' })
      .then((payload) => {
        if (cancelled) return;
        setOptions(
          (payload.data || []).map((item) => ({
            value: item.slug,
            label: item.name || item.slug,
            muted: item.visible === false,
          })),
        );
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [field.optionsFrom]);

  function toggle(optionValue, checked) {
    const next = checked
      ? [...selected.filter((item) => item !== optionValue), optionValue]
      : selected.filter((item) => item !== optionValue);
    onChange(next);
  }

  if (state === 'loading') return <p className="field-hint" id={id}>Đang tải danh sách...</p>;
  if (state === 'error') {
    return <p className="field-error" id={id}>Không tải được danh sách. Tải lại trang để thử lại.</p>;
  }

  const orphans = selected.filter((slug) => !options.some((option) => option.value === slug));

  if (!options.length && !orphans.length) {
    return <p className="field-hint" id={id}>Chưa có mục nào để chọn.</p>;
  }

  return (
    <div className="multi-select" id={id}>
      {options.map((option) => (
        <label className="check-row" key={option.value}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={(event) => toggle(option.value, event.target.checked)}
          />
          <span>
            {option.label}
            {option.muted ? <em className="multi-select-note"> (đang ẩn trên website)</em> : null}
          </span>
        </label>
      ))}
      {orphans.map((slug) => (
        <label className="check-row" key={slug}>
          <input type="checkbox" checked onChange={() => toggle(slug, false)} />
          <span>
            {slug}
            <em className="multi-select-note"> (danh mục đã bị xoá — bỏ tick để gỡ)</em>
          </span>
        </label>
      ))}
    </div>
  );
}

function toOption(option) {
  if (typeof option === 'object') return option;
  return { value: option, label: option };
}
