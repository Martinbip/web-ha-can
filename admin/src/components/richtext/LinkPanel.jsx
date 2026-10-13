import React, { useEffect, useState } from 'react';
import { listResources } from '../../api/resources.js';
import { normalizeLinkHref } from '../../lib/link.js';
import { isInternalHref } from '../../lib/seo.js';

// Các trang cố định của website — gắn link nội bộ tới đây không cần nhớ địa chỉ.
const SITE_PAGES = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Sản phẩm', href: '/products' },
  { label: 'Bảng giá', href: '/pricing' },
  { label: 'Dự tính chi phí', href: '/estimator' },
  { label: 'Tin tức', href: '/news' },
  { label: 'Dự án', href: '/projects' },
  { label: 'Liên hệ', href: '/contact' },
];

// Hộp chèn/sửa liên kết. Thay cho window.prompt cũ: có ô tìm bài viết, sản phẩm,
// trang trong website để gắn link nội bộ (điểm cộng SEO) mà không phải chép địa
// chỉ, và tuỳ chọn nofollow, dạng nút cho link ra ngoài.
export default function LinkPanel({ initial, hasSelection, onApply, onRemove, onClose }) {
  const [href, setHref] = useState(initial.href || '');
  // Chưa bôi đen chữ nào thì link cần chữ để hiện — mặc định là tên mục vừa chọn.
  const [label, setLabel] = useState('');
  const needsLabel = !hasSelection && !initial.href;
  const [nofollow, setNofollow] = useState(/\bnofollow\b/.test(initial.rel || ''));
  const [asButton, setAsButton] = useState(/\barticle-btn\b/.test(initial.class || ''));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const pages = SITE_PAGES.filter((page) => page.label.toLowerCase().includes(term.toLowerCase()))
        .map((page) => ({ ...page, kind: 'Trang' }));
      Promise.allSettled([
        listResources('news', { search: term, pageSize: 6 }),
        listResources('products', { search: term, pageSize: 6 }),
      ]).then(([news, products]) => {
        if (cancelled) return;
        const articles = news.status === 'fulfilled' ? news.value.data || [] : [];
        const items = products.status === 'fulfilled' ? products.value.data || [] : [];
        setResults([
          ...pages,
          ...articles.filter((item) => item.slug).map((item) => ({ kind: 'Bài viết', label: item.title, href: `/tin-tuc/${item.slug}` })),
          ...items.filter((item) => item.uid).map((item) => ({ kind: 'Sản phẩm', label: item.name, href: `/san-pham/${encodeURIComponent(item.uid)}` })),
        ]);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const normalized = normalizeLinkHref(href);
  const internal = normalized ? isInternalHref(normalized) : false;
  const external = normalized && /^https?:/i.test(normalized) && !internal;

  function apply(event) {
    event?.preventDefault();
    if (!href.trim()) {
      onRemove();
      return;
    }
    if (!normalized) {
      setError('Địa chỉ này không dùng được. Hãy nhập địa chỉ web, /trang-trong-site, email hoặc số điện thoại.');
      return;
    }
    onApply(
      {
        href: normalized,
        rel: external && nofollow ? 'nofollow' : null,
        class: asButton ? 'article-btn' : null,
      },
      needsLabel ? label.trim() || normalized : null,
    );
  }

  return (
    <div className="richtext-panel" role="dialog" aria-label="Chèn liên kết">
      <label className="richtext-panel-label" htmlFor="richtext-link-href">Địa chỉ liên kết</label>
      <div className="richtext-panel-row">
        <input
          id="richtext-link-href"
          type="text"
          value={href}
          placeholder="https://… hoặc /products, email, số điện thoại"
          onChange={(event) => {
            setHref(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply(event);
          }}
          autoFocus
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {normalized ? (
        <p className="richtext-panel-hint">
          {internal
            ? 'Link nội bộ: mở cùng tab, Google lần theo được (tốt cho SEO).'
            : external
              ? 'Link ra website khác: mở tab mới.'
              : 'Link email/điện thoại.'}
        </p>
      ) : null}

      <label className="richtext-panel-label" htmlFor="richtext-link-search">Hoặc tìm trong website</label>
      <input
        id="richtext-link-search"
        type="search"
        value={query}
        placeholder="Gõ tên bài viết, sản phẩm hoặc trang…"
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length ? (
        <ul className="richtext-link-results">
          {results.map((item) => (
            <li key={`${item.kind}-${item.href}`}>
              <button
                type="button"
                className={href === item.href ? 'is-active' : ''}
                onClick={() => {
                  setHref(item.href);
                  if (needsLabel && !label.trim()) setLabel(item.label);
                  setError('');
                }}
              >
                <span className="richtext-link-kind">{item.kind}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="richtext-panel-hint">Không tìm thấy mục nào.</p>
      ) : null}

      {needsLabel ? (
        <>
          <label className="richtext-panel-label" htmlFor="richtext-link-label">Chữ hiển thị</label>
          <input
            id="richtext-link-label"
            type="text"
            value={label}
            placeholder="Chữ người đọc bấm vào, vd: Xem giá nhôm thỏi"
            onChange={(event) => setLabel(event.target.value)}
          />
          <p className="richtext-panel-hint">Mẹo: bôi đen chữ trong bài trước khi bấm Liên kết để gắn link vào đúng chữ đó.</p>
        </>
      ) : null}

      <div className="richtext-panel-checks">
        {external ? (
          <label className="check-row">
            <input type="checkbox" checked={nofollow} onChange={(event) => setNofollow(event.target.checked)} />
            <span>Gắn nofollow (link quảng cáo, link không muốn Google tính điểm)</span>
          </label>
        ) : null}
        <label className="check-row">
          <input type="checkbox" checked={asButton} onChange={(event) => setAsButton(event.target.checked)} />
          <span>Hiện dạng nút bấm (nút kêu gọi, vd "Nhận báo giá")</span>
        </label>
      </div>

      <div className="richtext-panel-actions">
        <button type="button" className="btn-primary" onClick={apply}>Gắn liên kết</button>
        {initial.href ? (
          <button type="button" className="btn-secondary" onClick={onRemove}>Gỡ liên kết</button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
