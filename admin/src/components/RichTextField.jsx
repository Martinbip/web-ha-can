import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import ImagePicker from './ImagePicker.jsx';

// Trình soạn thảo nội dung bài viết. Giá trị vẫn là một chuỗi HTML nên hợp đồng
// value/onChange với FieldRenderer không đổi, nhưng biên tập viên làm việc trực
// quan: định dạng chữ, chèn liên kết và — điểm phản hồi chính từ khách — chèn
// ảnh minh hoạ vào giữa bài, không chỉ ảnh đại diện.
export default function RichTextField({ id, value, onChange, imageFolder = 'dha/news' }) {
  const [imagePanelOpen, setImagePanelOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { class: 'article-image' } }),
      Link.configure({ openOnClick: false, autolink: false }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Nội dung nạp về sau (trang sửa tải dữ liệu bất đồng bộ) phải được đẩy vào
  // editor, nhưng chỉ khi thực sự khác — setContent trong lúc gõ sẽ nhảy con trỏ.
  useEffect(() => {
    if (!editor) return;
    const next = toEditorHtml(value);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return <p>Đang tải trình soạn thảo...</p>;

  function insertImage(url) {
    if (!url) return;
    const alt = window.prompt('Chú thích ảnh (mô tả ngắn, giúp SEO và người khiếm thị):', '') || '';
    editor.chain().focus().setImage({ src: url, alt }).run();
    setImagePanelOpen(false);
  }

  function toggleLink() {
    const previous = editor.getAttributes('link').href || '';
    const input = window.prompt('Dán liên kết (để trống để bỏ liên kết):', previous);
    if (input === null) return;
    const href = input.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="richtext" id={id}>
      <div className="richtext-toolbar">
        <ToolbarButton active={editor.isActive('bold')} label="Đậm" onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} label="Nghiêng" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          label="Tiêu đề lớn"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          label="Tiêu đề nhỏ"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} label="Danh sách" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • Danh sách
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} label="Danh sách đánh số" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. Đánh số
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('blockquote')} label="Trích dẫn" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ❝ Trích dẫn
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('link')} label="Liên kết" onClick={toggleLink}>
          🔗 Liên kết
        </ToolbarButton>
        <ToolbarButton active={imagePanelOpen} label="Chèn ảnh vào bài" onClick={() => setImagePanelOpen((open) => !open)}>
          🖼 Chèn ảnh
        </ToolbarButton>
      </div>

      {imagePanelOpen ? (
        <div className="richtext-image-panel">
          <p className="richtext-image-hint">Tải ảnh mới hoặc chọn ảnh có sẵn — ảnh sẽ được chèn tại vị trí con trỏ.</p>
          <ImagePicker id={`${id}-image`} value="" onChange={insertImage} folder={imageFolder} showPreview={false} />
        </div>
      ) : null}

      <EditorContent className="richtext-content" editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, label, onClick, children }) {
  return (
    <button
      type="button"
      className={`richtext-toolbar-btn${active ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Nội dung cũ được lưu dưới dạng văn bản thuần với các dấu xuống dòng. Nạp thẳng
// vào editor sẽ dồn thành một đoạn dài, nên tách đoạn trước khi hiển thị.
export function toEditorHtml(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
