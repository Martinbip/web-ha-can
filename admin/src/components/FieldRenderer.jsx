import React from 'react';
import RichTextField from './RichTextField.jsx';
import ImagePicker from './ImagePicker.jsx';

// Maps one field config entry (from RESOURCE_CONFIG) + its current value to the
// right input control. Keeps list/edit pages free of per-type branching: they just
// render <FieldRenderer field={...} value={...} onChange={...} /> for every field.
export default function FieldRenderer({ name, field, value, onChange }) {
  const id = `field-${name}`;
  const label = field.label || name;

  return (
    <div className="field-row" key={name}>
      {field.type !== 'hidden' ? (
        <label htmlFor={id}>
          {label}
          {field.required ? <span className="field-required"> *</span> : null}
        </label>
      ) : null}
      {renderInput({ id, field, value, onChange })}
    </div>
  );
}

function renderInput({ id, field, value, onChange }) {
  switch (field.type) {
    case 'text':
      return (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          required={field.required}
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
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'number':
      return (
        <input
          id={id}
          type="number"
          value={value ?? ''}
          required={field.required}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        />
      );

    case 'textarea':
      return (
        <textarea
          id={id}
          rows={4}
          value={value ?? ''}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case 'richtext':
      return (
        <RichTextField
          id={id}
          value={value}
          required={field.required}
          onChange={onChange}
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
