import { Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';

// Cỡ và căn ảnh lưu thành class trên thẻ <img> — đúng những class mà bộ lọc
// bài viết trên website (ARTICLE_ALLOWED_CLASSES trong app.js) cho qua.
export const IMAGE_SIZES = [
  { value: '', label: 'Tự nhiên' },
  { value: 'sm', label: 'Nhỏ (40%)' },
  { value: 'md', label: 'Vừa (70%)' },
  { value: 'full', label: 'Toàn khổ' },
];

export const IMAGE_ALIGNS = [
  { value: '', label: 'Giữa (mặc định)' },
  { value: 'left', label: 'Trái, chữ chạy quanh' },
  { value: 'center', label: 'Giữa' },
  { value: 'right', label: 'Phải, chữ chạy quanh' },
];

function classValue(element, prefix, allowed) {
  const match = [...element.classList].find((name) => name.startsWith(prefix) && allowed.includes(name.slice(prefix.length)));
  return match ? match.slice(prefix.length) : null;
}

export const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: null,
        parseHTML: (element) => classValue(element, 'img-', ['sm', 'md', 'full']),
        renderHTML: (attributes) => (attributes.size ? { class: `img-${attributes.size}` } : {}),
      },
      align: {
        default: null,
        parseHTML: (element) => classValue(element, 'align-', ['left', 'center', 'right']),
        renderHTML: (attributes) => (attributes.align ? { class: `align-${attributes.align}` } : {}),
      },
    };
  },
}).configure({ HTMLAttributes: { class: 'article-image' } });

// Khung nổi bật: một khối nền vàng nhạt chứa vài đoạn văn, dùng cho ghi chú,
// mẹo, cảnh báo giữa bài.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.article-callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'article-callout' }), 0];
  },

  addCommands() {
    return {
      toggleCallout:
        () =>
        ({ commands, editor }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name),
    };
  },
});
