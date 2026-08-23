import React from 'react';

// Thanh lưu chung cho mọi màn hình sửa nội dung. Đặt ở đầu form và bám theo màn
// hình khi cuộn: form nội dung dài (bài viết, cài đặt website) mà để nút ở cuối
// thì mỗi lần lưu phải cuộn hết xuống đáy.
//
// Nút Lưu mặc định là nút gửi form, nên thanh này phải nằm bên trong thẻ <form>.
// Màn hình không dùng form (ví dụ menu) thì truyền onSave để bấm trực tiếp.
export default function SaveBar({
  saving = false,
  disabled = false,
  label = 'Lưu',
  savingLabel = 'Đang lưu...',
  onSave,
  onCancel,
  cancelLabel = 'Hủy',
  cancelDisabled = false,
  status = null,
}) {
  return (
    <div className="savebar">
      {status ? <div className="savebar-status">{status}</div> : <div className="savebar-status" />}
      <div className="savebar-actions">
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving || cancelDisabled}>
            {cancelLabel}
          </button>
        ) : null}
        <button
          type={onSave ? 'button' : 'submit'}
          className="btn-primary"
          onClick={onSave}
          disabled={saving || disabled}
        >
          {saving ? savingLabel : label}
        </button>
      </div>
    </div>
  );
}
