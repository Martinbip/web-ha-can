import React from 'react';

// Đầu trang của mọi màn hình sửa nội dung: tên việc đang làm bên trái, nút Lưu
// bên phải, bám theo màn hình khi cuộn. Gộp làm một thay vì tiêu đề một nơi và
// nút một nơi — form nội dung dài mà để nút ở cuối thì mỗi lần lưu phải cuộn
// hết xuống đáy, còn cuộn tới giữa bài thì không còn thấy đang sửa gì.
//
// Nút Lưu gửi form qua thuộc tính `form`, nên thanh không cần nằm trong thẻ
// <form>. Màn hình không dùng form (thanh menu) thì truyền onSave.
export default function SaveBar({
  title,
  description = null,
  formId,
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
    <>
      <div className="savebar">
        <h1 className="savebar-title">{title}</h1>
        <div className="savebar-actions">
          {status}
          {onCancel ? (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving || cancelDisabled}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type={onSave ? 'button' : 'submit'}
            form={formId}
            className="btn-primary"
            onClick={onSave}
            disabled={saving || disabled}
          >
            {saving ? savingLabel : label}
          </button>
        </div>
      </div>
      {description ? <p className="savebar-description">{description}</p> : null}
    </>
  );
}
