import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Youtube from '@tiptap/extension-youtube';
import { NodeSelection } from '@tiptap/pm/state';
import ImagePicker from './ImagePicker.jsx';
import LinkPanel from './richtext/LinkPanel.jsx';
import { ArticleImage, Callout, IMAGE_ALIGNS, IMAGE_SIZES } from './richtext/extensions.js';

// Trình soạn thảo nội dung bài viết. Giá trị vẫn là một chuỗi HTML nên hợp đồng
// value/onChange với FieldRenderer không đổi, nhưng biên tập viên làm việc trực
// quan: định dạng chữ, chèn liên kết và — điểm phản hồi chính từ khách — chèn
// ảnh minh hoạ vào giữa bài, không chỉ ảnh đại diện.
//
// Mọi thứ trình soạn thảo sinh ra phải lọt qua bộ lọc bài viết của website
// (sanitizeArticleHtml trong app.js): thêm nút mới ở đây thì mở thêm bên đó.
export default function RichTextField({ id, value, onChange, imageFolder = 'dha/news' }) {
  // Một lúc chỉ mở một bảng phụ: 'image' | 'link' | 'video' | null.
  const [panel, setPanel] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState('');
  // Đổi khi con trỏ/vùng chọn đổi, để thanh công cụ ảnh/bảng hiện đúng lúc.
  const [, setSelectionTick] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      ArticleImage,
      // Mặc định TipTap gắn target/rel nofollow cho mọi link — kể cả link nội bộ,
      // vốn là điểm cộng SEO. Website tự quyết target/rel theo loại link.
      Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { target: null, rel: null, class: null } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true, controls: true, HTMLAttributes: { class: 'article-video-embed' } }),
      Callout,
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    onSelectionUpdate: () => setSelectionTick((tick) => tick + 1),
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

  const chain = () => editor.chain().focus();
  const imageSelected = editor.isActive('image');
  const inTable = editor.isActive('table');

  function togglePanel(name) {
    setPanel((current) => (current === name ? null : name));
  }

  function insertImage(url) {
    if (!url) return;
    chain().setImage({ src: url, alt: '' }).run();
    // Chọn luôn ảnh vừa chèn để thanh chỉnh ảnh hiện ra — nhắc điền mô tả ngay.
    const { state } = editor;
    const pos = state.selection.from - 1;
    if (pos >= 0 && state.doc.nodeAt(pos)?.type.name === 'image') {
      editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
    }
    setPanel(null);
  }

  function applyLink(attrs, label) {
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Chưa bôi đen chữ nào thì không có gì để gắn liên kết vào — chèn luôn chữ
      // hiển thị (mặc định là địa chỉ), thay vì bấm xong mà trông như không có
      // chuyện gì.
      chain().insertContent({ type: 'text', text: label || attrs.href, marks: [{ type: 'link', attrs }] }).run();
    } else {
      chain().extendMarkRange('link').setLink(attrs).run();
    }
    setPanel(null);
  }

  function removeLink() {
    chain().extendMarkRange('link').unsetLink().run();
    setPanel(null);
  }

  function insertVideo(event) {
    event?.preventDefault();
    const ok = editor.commands.setYoutubeVideo({ src: videoUrl.trim() });
    if (!ok) {
      setVideoError('Chưa nhận ra link YouTube. Dán link dạng https://www.youtube.com/watch?v=… hoặc https://youtu.be/…');
      return;
    }
    setVideoUrl('');
    setVideoError('');
    setPanel(null);
  }

  function updateImage(attrs) {
    editor.chain().updateAttributes('image', attrs).run();
  }

  const imageAttrs = imageSelected ? editor.getAttributes('image') : null;

  return (
    <div className="richtext" id={id}>
      {/* Thanh công cụ cùng các hộp chèn và thanh chỉnh ảnh/bảng dính trên cùng
          khi cuộn: bài dài thì ảnh đang chọn có thể nằm rất xa đầu khung soạn. */}
      <div className="richtext-head">
      <div className="richtext-toolbar" role="toolbar" aria-label="Định dạng nội dung">
        <div className="richtext-toolbar-group">
          <ToolbarButton label="Hoàn tác (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>↶</ToolbarButton>
          <ToolbarButton label="Làm lại (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>↷</ToolbarButton>
        </div>
        <div className="richtext-toolbar-group">
          <ToolbarButton active={editor.isActive('bold')} label="Đậm" onClick={() => chain().toggleBold().run()}>
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} label="Nghiêng" onClick={() => chain().toggleItalic().run()}>
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('underline')} label="Gạch chân" onClick={() => chain().toggleUnderline().run()}>
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('strike')} label="Gạch ngang" onClick={() => chain().toggleStrike().run()}>
            <s>S</s>
          </ToolbarButton>
        </div>
        <div className="richtext-toolbar-group">
          <ToolbarButton active={editor.isActive('heading', { level: 2 })} label="Tiêu đề mục (H2)" onClick={() => chain().toggleHeading({ level: 2 }).run()}>
            H2
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 3 })} label="Tiêu đề nhỏ (H3)" onClick={() => chain().toggleHeading({ level: 3 }).run()}>
            H3
          </ToolbarButton>
        </div>
        <div className="richtext-toolbar-group">
          <ToolbarButton active={editor.isActive({ textAlign: 'left' })} label="Căn trái" onClick={() => chain().setTextAlign('left').run()}>⯇</ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'center' })} label="Căn giữa" onClick={() => chain().setTextAlign('center').run()}>≡</ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'right' })} label="Căn phải" onClick={() => chain().setTextAlign('right').run()}>⯈</ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'justify' })} label="Căn đều hai bên" onClick={() => chain().setTextAlign('justify').run()}>☰</ToolbarButton>
        </div>
        <div className="richtext-toolbar-group">
          <ToolbarButton active={editor.isActive('bulletList')} label="Danh sách" onClick={() => chain().toggleBulletList().run()}>
            • Danh sách
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('orderedList')} label="Danh sách đánh số" onClick={() => chain().toggleOrderedList().run()}>
            1. Đánh số
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('blockquote')} label="Trích dẫn" onClick={() => chain().toggleBlockquote().run()}>
            ❝ Trích dẫn
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('callout')} label="Khung nổi bật (ghi chú, lưu ý)" onClick={() => chain().toggleCallout().run()}>
            ★ Khung nổi bật
          </ToolbarButton>
          <ToolbarButton label="Đường kẻ ngang" onClick={() => chain().setHorizontalRule().run()}>
            ― Kẻ ngang
          </ToolbarButton>
        </div>
        <div className="richtext-toolbar-group">
          <ToolbarButton active={panel === 'link' || editor.isActive('link')} label="Liên kết" onClick={() => togglePanel('link')}>
            🔗 Liên kết
          </ToolbarButton>
          <ToolbarButton active={panel === 'image'} label="Chèn ảnh vào bài" onClick={() => togglePanel('image')}>
            🖼 Chèn ảnh
          </ToolbarButton>
          <ToolbarButton active={panel === 'video'} label="Chèn video YouTube" onClick={() => togglePanel('video')}>
            ▶ Video
          </ToolbarButton>
          <ToolbarButton
            label="Chèn bảng 3×3"
            disabled={inTable}
            onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            ▦ Bảng
          </ToolbarButton>
        </div>
      </div>

      {panel === 'image' ? (
        <div className="richtext-panel">
          <p className="richtext-panel-hint">Tải ảnh mới hoặc chọn ảnh có sẵn — ảnh sẽ được chèn tại vị trí con trỏ. Chèn xong, điền mô tả ảnh ở thanh chỉnh ảnh hiện ra.</p>
          <ImagePicker id={`${id}-image`} value="" onChange={insertImage} folder={imageFolder} showPreview={false} />
        </div>
      ) : null}

      {panel === 'link' ? (
        <LinkPanel
          initial={editor.getAttributes('link')}
          hasSelection={!editor.state.selection.empty}
          onApply={applyLink}
          onRemove={removeLink}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel === 'video' ? (
        <div className="richtext-panel">
          <label className="richtext-panel-label" htmlFor={`${id}-video`}>Link video YouTube</label>
          <div className="richtext-panel-row">
            <input
              id={`${id}-video`}
              type="url"
              value={videoUrl}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(event) => {
                setVideoUrl(event.target.value);
                setVideoError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') insertVideo(event);
              }}
              autoFocus
            />
            <button type="button" className="btn-primary" onClick={insertVideo}>Chèn video</button>
          </div>
          {videoError ? <p className="form-error">{videoError}</p> : null}
        </div>
      ) : null}

      {imageAttrs ? (
        <div className="richtext-contextbar" aria-label="Chỉnh ảnh đang chọn">
          <strong>Ảnh đang chọn</strong>
          <label>
            Mô tả ảnh (alt)
            <input
              type="text"
              value={imageAttrs.alt || ''}
              placeholder="Vd: Đồng cathode tại kho DHA"
              onChange={(event) => updateImage({ alt: event.target.value })}
            />
          </label>
          <label>
            Chú thích dưới ảnh
            <input
              type="text"
              value={imageAttrs.title || ''}
              placeholder="Hiện thành dòng chữ nhỏ dưới ảnh (không bắt buộc)"
              onChange={(event) => updateImage({ title: event.target.value })}
            />
          </label>
          <label>
            Cỡ
            <select value={imageAttrs.size || ''} onChange={(event) => updateImage({ size: event.target.value || null })}>
              {IMAGE_SIZES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Vị trí
            <select value={imageAttrs.align || ''} onChange={(event) => updateImage({ align: event.target.value || null })}>
              {IMAGE_ALIGNS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={() => chain().deleteSelection().run()}>Xoá ảnh</button>
          <p className="richtext-panel-hint">Mô tả ảnh giúp Google hiểu ảnh và đọc cho người khiếm thị — nên điền cho mọi ảnh.</p>
        </div>
      ) : null}

      {inTable ? (
        <div className="richtext-contextbar" aria-label="Chỉnh bảng">
          <strong>Bảng</strong>
          <button type="button" className="btn-secondary" onClick={() => chain().addRowAfter().run()}>+ Hàng</button>
          <button type="button" className="btn-secondary" onClick={() => chain().addColumnAfter().run()}>+ Cột</button>
          <button type="button" className="btn-secondary" onClick={() => chain().deleteRow().run()}>− Hàng</button>
          <button type="button" className="btn-secondary" onClick={() => chain().deleteColumn().run()}>− Cột</button>
          <button type="button" className="btn-secondary" onClick={() => chain().toggleHeaderRow().run()}>Bật/tắt hàng tiêu đề</button>
          <button type="button" className="btn-secondary" onClick={() => chain().deleteTable().run()}>Xoá bảng</button>
        </div>
      ) : null}

      </div>

      <EditorContent className="richtext-content" editor={editor} />
    </div>
  );
}

function ToolbarButton({ active = false, disabled = false, label, onClick, children }) {
  return (
    <button
      type="button"
      className={`richtext-toolbar-btn${active ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
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
