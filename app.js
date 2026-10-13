/**
 * DHA Minerals — Kim Loại Màu
 * Main Application Logic
 */

'use strict';

// ── CMS Config ──
const CMS_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:1337'
    : (window.__STRAPI_URL || 'http://localhost:1337');
const CMS_API  = `${CMS_BASE}/api`;

// ── Product Group Labels & CSS ──
const GROUP_LABEL = {
    'dong':   'Đồng',
    'nhom':   'Nhôm',
    'chi':    'Chì',
    'thiec':  'Thiếc',
    'quang':  'Quặng',
};
const GROUP_CSS = {
    'dong':   'group-dong',
    'nhom':   'group-nhom',
    'chi':    'group-chi',
    'thiec':  'group-thiec',
    'quang':  'group-quang',
};

// Quặng gộp chung group 'quang' nhưng thuộc 2 danh mục khác nhau
// (kim loại màu vs kim loại đen) nên cần badge riêng để phân biệt.
function getProductBadge(product) {
    const uid  = (product.uid || '').toLowerCase();
    const name = (product.name || '').toLowerCase();

    if (product.group === 'quang') {
        const isBlackMetal = uid.includes('sat') || name.includes('sắt');
        return isBlackMetal
            ? { label: 'Quặng Sắt', css: 'group-quang-sat' }
            : { label: 'Quặng Màu', css: 'group-quang-mau' };
    }
    if (product.group === 'rare-earth' || uid.includes('dat-hiem') || name.includes('đất hiếm')) {
        return { label: 'Đất Hiếm', css: 'group-rare-earth' };
    }
    return {
        label: GROUP_LABEL[product.group] || escapeHtml(product.group),
        css: GROUP_CSS[product.group] || '',
    };
}

// ── HTML Escape (XSS prevention) ──
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeInternalUrl(value, fallback = '#') {
    if (!value) return fallback;
    const raw = String(value).trim();
    if (raw.startsWith('/') || raw.startsWith('#')) return raw;
    return fallback;
}

// Công tắc "Giá liên hệ" trong CMS là ý định rõ ràng của quản trị viên; sản phẩm
// chưa kịp điền giá cũng rơi về cùng cách hiển thị đó. Chữ thay thế và đơn vị lấy
// theo thứ tự: khai báo riêng của sản phẩm → mặc định trong Cài đặt website →
// giá trị dự phòng cứng, chỉ dùng khi cả hai nơi đều bỏ trống.
function getProductPriceLabel(product) {
    const settings = window.__siteSettings || {};
    const price = Number(product?.price);
    const hasPrice = Number.isFinite(price) && price > 0;

    if (product?.price_on_request || !hasPrice) {
        const label = firstFilled(product?.price_label, settings.price_contact_text, 'Liên hệ');
        return { text: label, isContact: true };
    }
    const unit = firstFilled(product?.price_unit, settings.price_unit_default, 'đ/kg');
    return { text: `${price.toLocaleString('vi-VN')}${unit}`, isContact: false };
}

function firstFilled(...values) {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return '';
}

// Ảnh trong CMS là URL Cloudinary tuyệt đối, nhưng dữ liệu dự phòng trong data/
// lại ghi kiểu "assets/anh.png". Đường dẫn tương đối như vậy gãy ở những trang
// nằm sâu như /tin-tuc/<duong-dan>, nên chuẩn hoá về gốc site.
function toSiteAssetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('data:')) return raw;
    return `/${raw}`;
}

function getProjectImageUrl(project) {
    if (project?.cloudinary_image_url) return project.cloudinary_image_url;
    if (project?.image?.url) return `${CMS_BASE}${project.image.url}`;
    if (typeof project?.image === 'string') return project.image;
    return '';
}

// ======================================================
// DANH MỤC SẢN PHẨM
// ======================================================
// Các tab lọc trên trang chủ và trang Sản phẩm do quản trị tự đặt trong CMS
// (collection product-categories). Sản phẩm mang một mảng mã danh mục ở trường
// `categories`. Trước đây bốn tab này viết cứng trong HTML và luật lọc đoán
// theo tên sản phẩm — đó là lý do có tab luôn hiện 0 sản phẩm.
const DEFAULT_PRODUCT_CATEGORIES = [
    { slug: 'color-metal', name: 'Kim Loại Màu' },
    { slug: 'black-metal', name: 'Kim Loại Đen' },
    { slug: 'rare-earth', name: 'Đất Hiếm' },
];

const PRODUCT_CATEGORIES_ENDPOINT = 'product-categories?sort=sort_order:asc&pagination[limit]=100';

// Bỏ mục ẩn; không còn mục nào thì về mặc định. Cùng quy tắc với
// pickVisibleCategories() trong scripts/prerender-site-settings.js.
function pickVisibleCategories(items) {
    const usable = (items || []).filter(item => item && item.slug && item.visible !== false);
    return usable.length ? usable : DEFAULT_PRODUCT_CATEGORIES;
}

// HTML phục vụ cho khách đã được prerender ghi sẵn danh mục mới nhất, nên phải
// biết dữ liệu đến từ CMS thật hay từ file dự phòng: bản dự phòng có thể cũ hơn
// HTML, dùng nó ghi đè là kéo trang lùi về dữ liệu cũ. Mỗi lượt tải trang chỉ
// gọi CMS một lần — tab lọc và danh sách danh mục dùng chung kết quả.
let productCategoriesPromise = null;

function loadProductCategories() {
    if (!productCategoriesPromise) {
        productCategoriesPromise = (async () => {
            try {
                const res = await fetch(`${CMS_API}/${PRODUCT_CATEGORIES_ENDPOINT}`, { signal: AbortSignal.timeout(3000) });
                if (!res.ok) throw new Error(`CMS responded ${res.status}`);
                const json = await res.json();
                const items = (json.data || []).map(item => item.attributes || item);
                return { categories: pickVisibleCategories(items), fromCMS: true };
            } catch (err) {
                console.warn('[CMS] product-categories failed, keeping prerendered HTML:', err);
                try {
                    const res = await fetch('/data/product_categories.json');
                    if (!res.ok) throw new Error(`Fallback ${res.status}`);
                    return { categories: pickVisibleCategories(await res.json()), fromCMS: false };
                } catch {
                    return { categories: DEFAULT_PRODUCT_CATEGORIES, fromCMS: false };
                }
            }
        })();
    }
    return productCategoriesPromise;
}

// Phải cho ra cùng một DOM với renderCategoryLinks() trong
// scripts/prerender-site-settings.js — lệch nhau là danh sách chớp.
function renderCategoryLinks(categories) {
    return categories
        .map(category => `<li><a href="/products?filter=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`)
        .join('');
}

// Khối danh mục bên hông trang chủ và cột danh mục ở chân trang mọi trang.
async function initCategoryLinks() {
    const lists = document.querySelectorAll('[data-category-list]');
    if (!lists.length) return;
    const { categories, fromCMS } = await loadProductCategories();
    if (!fromCMS) return;
    const html = renderCategoryLinks(categories);
    lists.forEach(list => { list.innerHTML = html; });
}

// Tab lọc cần số lượng sản phẩm nên luôn được dựng lại. Khi CMS lỗi, lấy danh
// mục từ chính các tab prerender đã ghi sẵn (mới hơn file dự phòng); HTML chưa
// qua prerender (máy dev) thì mới dùng file dự phòng.
async function resolveTabCategories(container) {
    const { categories, fromCMS } = await loadProductCategories();
    if (fromCMS || !container) return categories;
    const prerendered = [...container.querySelectorAll('[data-filter]:not([data-filter="all"])')]
        .map(btn => ({ slug: btn.dataset.filter, name: (btn.firstChild?.textContent || '').trim() }))
        .filter(tab => tab.slug && tab.name);
    return prerendered.length ? prerendered : categories;
}

function getProductCategorySlugs(product) {
    const raw = product?.categories;
    if (!Array.isArray(raw)) return [];
    return raw.filter(slug => typeof slug === 'string' && slug);
}

function productMatchesCategory(product, slug) {
    if (!slug || slug === 'all') return true;
    return getProductCategorySlugs(product).includes(slug);
}

// Dựng lại thanh tab từ danh mục CMS. Nút "Tất Cả" luôn đứng đầu và không đến
// từ CMS — bỏ nó đi thì không còn đường quay lại toàn bộ danh sách.
function renderCategoryTabs(container, categories, products, options) {
    if (!container) return;
    const { buttonClass, countClass, wrapCount } = options;
    const tabs = [{ slug: 'all', name: 'Tất Cả' }, ...categories];

    container.innerHTML = tabs.map((tab, index) => {
        const count = tab.slug === 'all'
            ? products.length
            : products.filter(product => productMatchesCategory(product, tab.slug)).length;
        const isFirst = index === 0;
        const countHtml = wrapCount
            ? `<span class="${countClass}">${count}</span>`
            : `<em>(${count})</em>`;
        return `
            <button class="${buttonClass}${isFirst ? ' active' : ''}"
                    data-filter="${escapeHtml(tab.slug)}"
                    role="tab"
                    aria-selected="${isFirst ? 'true' : 'false'}">
                ${escapeHtml(tab.name)} ${countHtml}
            </button>
        `;
    }).join('');
}

// ======================================================
// CMS DATA FETCHING
// ======================================================
async function fetchFromCMS(endpoint, fallbackFile) {
    try {
        const res = await fetch(`${CMS_API}/${endpoint}`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`CMS responded ${res.status}`);
        const json = await res.json();
        return (json.data || []).map(item => item.attributes || item);
    } catch (err) {
        // Nội dung mà quản trị thay đổi thường xuyên (ví dụ hero slides) gọi
        // hàm này không kèm fallbackFile: thà không hiển thị còn hơn hiển thị
        // một bản sao cũ khác với những gì đang có trong admin.
        if (!fallbackFile) {
            console.error(`[CMS] ${endpoint} failed and has no fallback:`, err);
            return [];
        }
        console.warn(`[CMS] Fallback to ${fallbackFile}`);
        try {
            const res = await fetch(fallbackFile);
            if (!res.ok) throw new Error(`Fallback ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error(`[CMS] Both sources failed:`, e);
            return [];
        }
    }
}

async function fetchSingleFromCMS(endpoint, fallbackFile) {
    try {
        const res = await fetch(`${CMS_API}/${endpoint}`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`CMS responded ${res.status}`);
        const json = await res.json();
        const d = json.data;
        return d?.attributes || d || null;
    } catch (err) {
        // Nội dung mà quản trị thay đổi thường xuyên gọi hàm này không kèm
        // fallbackFile: thà không đổi gì còn hơn tải một địa chỉ không có thật.
        if (!fallbackFile) {
            console.error(`[CMS] ${endpoint} failed and has no fallback:`, err);
            return null;
        }
        console.warn(`[CMS] Fallback to ${fallbackFile}`);
        try {
            const res = await fetch(fallbackFile);
            if (!res.ok) throw new Error(`Fallback ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error(`[CMS] Both sources failed:`, e);
            return null;
        }
    }
}

// Một số collection chưa được nhập nội dung trong CMS (dịch vụ, quy trình).
// Với chúng, bản mẫu trong data/ đóng vai trò nội dung khởi tạo: chỉ dùng khi
// CMS chưa có gì, và bị CMS thay thế ngay khi quản trị nhập bản ghi đầu tiên.
// Khác với fallback lỗi mạng, ở đây không có gì trong admin để mà lệch.
async function fetchWithSeedContent(endpoint, seedFile) {
    const items = await fetchFromCMS(endpoint, seedFile);
    if (items && items.length > 0) return items;

    try {
        const res = await fetch(seedFile);
        if (!res.ok) throw new Error(`Seed ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`[CMS] ${endpoint} rỗng và không đọc được ${seedFile}:`, err);
        return [];
    }
}

// ======================================================
// DOMContentLoaded — MAIN ENTRY
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initNavigationMenu();
    initScrollTopButton();
    initSiteSettings();
    initPageContent();
    initCategoryLinks();
    initDynamicContent();
    initContactForm();
    initEstimator();
    injectSiteComponents();
});

// ======================================================
// SITE SETTINGS — Dynamic header, footer, contact info
// ======================================================
// Cài đặt website được nhiều nơi dùng chung (giá, hotline, chữ thay cho giá), nên
// chỉ gọi CMS một lần và chia sẻ chung lời hứa — phần render nào cần thì chờ nó.
let siteSettingsPromise = null;

// Chữ do quản trị đặt đã được prerender ghi sẵn vào HTML (xem
// scripts/prerender-site-settings.js), nên không cần — và không được — áp chữ từ
// bộ nhớ đệm: quản trị xoá trắng một ô thì CMS trả ô trống, nghĩa là "giữ chữ
// đang có trên trang", mà chữ đó lại là bản cũ vừa áp từ bộ nhớ đệm — khách quay
// lại thấy giá trị cũ thêm một lượt. Bộ nhớ đệm chỉ còn lo phần prerender không
// ghi được: ảnh logo và favicon, để logo không chớp từ chữ sang ảnh.
const SITE_SETTINGS_CACHE_KEY = 'dha:site-settings:v1';

function readCachedSiteSettings() {
    try {
        const raw = window.localStorage.getItem(SITE_SETTINGS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        // Bộ nhớ đệm hỏng hoặc bị trình duyệt chặn: coi như chưa có, không chặn trang.
        return null;
    }
}

function writeCachedSiteSettings(settings) {
    try {
        window.localStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch {
        /* riêng tư / hết dung lượng — bỏ qua, chỉ mất phần chống chớp */
    }
}

// Chạy đồng bộ ngay lúc app.js được nạp (thẻ script nằm cuối body nên DOM đã đủ),
// trước cả DOMContentLoaded, để ảnh logo có mặt ngay từ khung hình đầu tiên. Chỉ
// truyền các ô ảnh: chữ logo bỏ trống thì applyLogo giữ nguyên chữ trong HTML.
function applyCachedSiteSettings() {
    const cached = readCachedSiteSettings();
    if (!cached) return;
    applyLogo({
        logo_image_url: cached.logo_image_url,
        logo_image_dark_url: cached.logo_image_dark_url,
        logo_alt: cached.logo_alt,
    });
    applyFavicon({ favicon_url: cached.favicon_url });
}

function loadSiteSettings() {
    if (!siteSettingsPromise) {
        siteSettingsPromise = fetchSingleFromCMS('site-setting', '/data/site_setting.json')
            .then((settings) => {
                window.__siteSettings = settings || {};
                return window.__siteSettings;
            })
            .catch(() => {
                window.__siteSettings = {};
                return window.__siteSettings;
            });
    }
    return siteSettingsPromise;
}

async function initSiteSettings() {
    const settings = await loadSiteSettings();
    if (!settings || !Object.keys(settings).length) return;

    writeCachedSiteSettings(settings);
    renderSiteSettings(settings);
    // Ảnh hero là dữ liệu riêng, chỉ gọi sau khi đã có cài đặt thật — không lặp
    // lại ở lượt áp bộ nhớ đệm.
    initHeroSlides();
}

function renderSiteSettings(settings) {
    // Ô nào quản trị bỏ trống thì giữ nguyên chữ có sẵn trong HTML, không xóa
    // trắng — vừa tránh mất thông tin liên hệ, vừa khớp với bản đã prerender
    // lúc deploy (xem scripts/prerender-site-settings.js) nên không chớp.
    const hotline = String(settings.hotline || '').trim();
    const hotlineClean = hotline.replace(/[.\s\-()]/g, '');
    const email = String(settings.email || '').trim();

    document.querySelectorAll('.site-hotline').forEach(el => {
        if (!hotline) return;
        el.textContent = hotline;
        if (el.tagName === 'A') el.href = `tel:${hotlineClean}`;
    });

    document.querySelectorAll('a[href^="tel:"]').forEach(el => {
        if (hotlineClean) el.href = `tel:${hotlineClean}`;
    });

    document.querySelectorAll('.site-email').forEach(el => {
        if (!email) return;
        el.textContent = email;
        if (el.tagName === 'A') el.href = `mailto:${email}`;
    });

    document.querySelectorAll('.site-address').forEach(el => {
        if (settings.address) el.textContent = settings.address;
    });

    document.querySelectorAll('.site-office-name').forEach(el => {
        if (settings.office_name) el.textContent = settings.office_name;
    });

    document.querySelectorAll('.site-tax-code').forEach(el => {
        if (settings.tax_code) {
            el.textContent = `MST: ${settings.tax_code} do Sở KH&ĐT TP. Hà Nội cấp.`;
        }
    });

    document.querySelectorAll('.site-brand-bio').forEach(el => {
        if (settings.brand_bio) el.textContent = settings.brand_bio;
    });

    // Link mạng xã hội chỉ hiện khi quản trị đã nhập địa chỉ thật. Trước đây
    // markup để sẵn các link mẫu (facebook.com/kimloaimaudha...) và chỉ ghi đè
    // khi CMS có dữ liệu, nên khi bỏ trống thì trang vẫn dẫn khách tới những
    // tài khoản không tồn tại.
    const SOCIAL_LINKS = [
        ['Facebook', settings.facebook_url],
        ['YouTube', settings.youtube_url],
        ['Twitter/X', settings.twitter_url],
        // Zalo dùng chính số hotline khi quản trị chưa nhập link riêng — đây là
        // kênh liên hệ chính ở VN, suy ra được thì không nên ẩn đi.
        ['Zalo', settings.zalo_url || (hotlineClean ? `https://zalo.me/${hotlineClean}` : '')],
    ];
    SOCIAL_LINKS.forEach(([label, url]) => {
        document.querySelectorAll(`a[aria-label="${label}"]`).forEach(el => {
            if (url) {
                el.href = url;
                el.hidden = false;
            } else {
                el.hidden = true;
            }
        });
    });

    applySiteTexts(settings);
    applySiteChrome(settings);
    applyLogo(settings);
    applyFavicon(settings);
    initHeroContent(settings);
}

// Logo đứng ở header lẫn footer của mọi trang. Quản trị có hai cách đặt: tải ảnh
// lên (ưu tiên) hoặc sửa hai mảnh chữ "DHA" + "MINERALS". Chân trang nền đen nên
// có ô ảnh riêng; thiếu ô đó thì dùng ảnh chính, thiếu cả ảnh thì về logo chữ —
// ảnh hỏng đường dẫn cũng rơi về chữ, không để trống một khoảng ở đầu trang.
function applyLogo(settings) {
    const imageUrl = toSiteAssetUrl(String(settings.logo_image_url || '').trim());
    const darkImageUrl = toSiteAssetUrl(String(settings.logo_image_dark_url || '').trim()) || imageUrl;
    const accent = String(settings.logo_text_accent || '').trim();
    const main = String(settings.logo_text_main || '').trim();

    document.querySelectorAll('a.logo').forEach(link => {
        // Logo chân trang nằm trên nền tối, dùng bản ảnh riêng nếu quản trị có đặt.
        const url = link.closest('.footer') ? darkImageUrl : imageUrl;
        const accentEl = link.querySelector('.logo-accent');
        const mainEl = link.querySelector('.logo-text');
        if (accentEl && accent) accentEl.textContent = accent;
        if (mainEl && main) mainEl.textContent = main;

        const altText = String(settings.logo_alt || '').trim()
            || [accentEl?.textContent, mainEl?.textContent].map(text => String(text || '').trim()).filter(Boolean).join(' ')
            || 'Trang chủ';

        let img = link.querySelector('.logo-img');
        if (!url) {
            if (img) img.remove();
            link.classList.remove('logo-has-image');
            return;
        }

        if (!img) {
            img = document.createElement('img');
            img.className = 'logo-img';
            img.addEventListener('error', () => {
                img.remove();
                link.classList.remove('logo-has-image');
            });
            link.prepend(img);
        }
        img.src = url;
        img.alt = altText;
        link.classList.add('logo-has-image');
    });
}

// Favicon tĩnh trong HTML là bản dự phòng. Quản trị tải ảnh khác lên thì gỡ hẳn
// các thẻ tĩnh đi rồi cắm một thẻ của mình vào — để lẫn lộn thì trình duyệt tự
// chọn, và thường vẫn giữ icon cũ. Bỏ ảnh trong CMS thì trả lại thẻ tĩnh.
let defaultIconLinks = null;

function applyFavicon(settings) {
    const head = document.head;
    if (!head) return;

    if (defaultIconLinks === null) {
        defaultIconLinks = [...head.querySelectorAll('link[rel~="icon"]:not([data-site-favicon])')];
    }

    const url = toSiteAssetUrl(String(settings.favicon_url || '').trim());
    let custom = head.querySelector('link[data-site-favicon]');

    if (!url) {
        if (custom) custom.remove();
        defaultIconLinks.forEach(link => {
            if (!link.isConnected) head.appendChild(link);
        });
        return;
    }

    defaultIconLinks.forEach(link => link.remove());

    if (!custom) {
        custom = document.createElement('link');
        custom.setAttribute('data-site-favicon', '');
        custom.rel = 'icon';
        head.appendChild(custom);
    }

    const type = getFaviconType(url);
    if (type) custom.type = type;
    else custom.removeAttribute('type');
    custom.href = url;
}

// Thiếu type thì Safari hay bỏ qua icon; suy ra từ đuôi file, bỏ phần ?query.
function getFaviconType(url) {
    const clean = String(url).split(/[?#]/)[0].toLowerCase();
    if (clean.endsWith('.svg')) return 'image/svg+xml';
    if (clean.endsWith('.png')) return 'image/png';
    if (clean.endsWith('.ico')) return 'image/x-icon';
    if (clean.endsWith('.webp')) return 'image/webp';
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
    return '';
}

// Các câu chữ cố định quanh bảng giá từng nằm cứng trong HTML, quản trị không sửa
// được. Giờ mỗi câu đánh dấu data-site-text="<tên trường trong Cài đặt website>";
// bỏ trống trong CMS thì giữ nguyên chữ có sẵn trong HTML làm dự phòng.
function applySiteTexts(settings) {
    document.querySelectorAll('[data-site-text]').forEach(el => {
        const value = String(settings[el.dataset.siteText] ?? '').trim();
        if (value) el.textContent = value;
    });
}

// Liên kết chân trang — cùng quy tắc với renderFooterLinks() trong
// scripts/prerender-site-settings.js; lệch nhau là chân trang chớp.
function renderFooterLinks(items) {
    if (!Array.isArray(items)) return '';
    return items
        .filter(item => item && item.visible !== false && String(item.label ?? '').trim() && safeNavUrl(item.url))
        .map(item => `<li><a href="${escapeHtml(safeNavUrl(item.url))}">${escapeHtml(item.label)}</a></li>`)
        .join('');
}

// Phần đầu trang/chân trang không đi qua data-site-text: danh sách liên kết,
// dòng bản quyền (tự ghép năm) và link của nút đầu trang. Ô nào bỏ trống hoặc
// sai quy tắc thì giữ nguyên HTML — khớp với bản đã prerender.
function applySiteChrome(settings) {
    const footerLinks = renderFooterLinks(settings.footer_links);
    if (footerLinks) {
        document.querySelectorAll('[data-footer-links]').forEach(list => { list.innerHTML = footerLinks; });
    }

    // Ô bỏ trống thì giữ chữ mặc định trong HTML nhưng vẫn đổi năm ở đầu dòng.
    // Cùng quy tắc với prerender (scripts/prerender-site-settings.js).
    const copyright = String(settings.copyright_text ?? '').trim();
    const year = new Date().getFullYear();
    document.querySelectorAll('[data-copyright]').forEach(el => {
        const line = copyright
            ? `© ${year} ${copyright}`
            : el.textContent.replace(/^(\s*©\s*)\d{4}/, `$1${year}`);
        if (line !== el.textContent) el.textContent = line;
    });

    const ctaUrl = safeNavUrl(settings.header_cta_url);
    if (ctaUrl) {
        document.querySelectorAll('.btn-contact').forEach(el => { el.setAttribute('href', ctaUrl); });
    }
}

// ======================================================
// NỘI DUNG TỪNG TRANG
// ======================================================
// Chữ và thẻ SEO của mỗi trang do quản trị đặt (mục "Nội dung trang" trong
// admin). Prerender đã ghi sẵn vào HTML; đoạn này áp lại khi CMS trả lời, ra
// đúng cùng một DOM (xem scripts/prerender-site-settings.js).
function renderPageList(items) {
    if (!Array.isArray(items)) return '';
    return items
        .map(line => (typeof line === 'string' ? line.trim() : ''))
        .filter(Boolean)
        .map(line => `<li>${escapeHtml(line)}</li>`)
        .join('');
}

function applyPageContent(content) {
    const page = document.body?.dataset?.page;
    if (!page) return;
    const texts = content?.texts?.[page];
    const seo = content?.seo?.[page];
    const pageText = key => {
        const value = texts && typeof texts[key] === 'string' ? texts[key].trim() : '';
        return value || '';
    };

    document.querySelectorAll('[data-page-text]').forEach(el => {
        const value = pageText(el.dataset.pageText);
        if (value) el.innerHTML = escapeHtml(value).replace(/\n/g, '<br>');
    });

    document.querySelectorAll('[data-page-href]').forEach(el => {
        const url = safeNavUrl(pageText(el.dataset.pageHref));
        if (url) el.setAttribute('href', url);
    });

    document.querySelectorAll('[data-page-list]').forEach(el => {
        const html = renderPageList(texts?.[el.dataset.pageList]);
        if (html) el.innerHTML = html;
    });

    document.querySelectorAll('[data-page-seo]').forEach(el => {
        const key = el.dataset.pageSeo;
        const raw = seo && typeof seo[key] === 'string' ? seo[key].trim() : '';
        const value = key === 'image' ? safeNavUrl(raw) : raw;
        if (!value) return;
        if (el.tagName === 'TITLE') el.textContent = value;
        else el.setAttribute('content', value);
    });
}

async function initPageContent() {
    if (!document.body?.dataset?.page) return;
    // Hai trang chi tiết mang data-page nhưng không có dấu nào (tiêu đề, mô tả
    // của chúng do JS đặt theo từng sản phẩm/bài viết) — không cần gọi CMS.
    if (!document.querySelector('[data-page-text], [data-page-href], [data-page-list], [data-page-seo]')) return;
    const content = await fetchSingleFromCMS('page-content');
    if (content && Object.keys(content).length) applyPageContent(content);
}

// ======================================================
// HERO — Dynamic content from site settings
// ======================================================
function initHeroContent(settings) {
    const tagline = document.querySelector('.hero-tagline');
    if (tagline && settings.hero_tagline) tagline.textContent = settings.hero_tagline;

    const title = document.querySelector('.hero-title');
    if (title && settings.hero_title) title.innerHTML = escapeHtml(settings.hero_title).replace(/\n/g, '<br>');

    const desc = document.querySelector('.hero-description');
    if (desc && settings.hero_description) desc.textContent = settings.hero_description;

    const certLabel = document.querySelector('.spec-badge-label');
    if (certLabel && settings.hero_cert_label) certLabel.textContent = settings.hero_cert_label;

    const certValue = document.querySelector('.spec-badge-value');
    if (certValue && settings.hero_cert_value) certValue.textContent = settings.hero_cert_value;

    const stats = document.querySelectorAll('.stat-item');
    if (stats.length >= 3) {
        if (settings.stat1_number) {
            stats[0].querySelector('.stat-number').textContent = settings.stat1_number;
            stats[0].querySelector('.stat-label').textContent = settings.stat1_label || '';
        }
        if (settings.stat2_number) {
            stats[1].querySelector('.stat-number').textContent = settings.stat2_number;
            stats[1].querySelector('.stat-label').textContent = settings.stat2_label || '';
        }
        if (settings.stat3_number) {
            stats[2].querySelector('.stat-number').textContent = settings.stat3_number;
            stats[2].querySelector('.stat-label').textContent = settings.stat3_label || '';
        }
    }
}

// ======================================================
// HERO SLIDES — Dynamic carousel from CMS
// ======================================================
async function initHeroSlides() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;

    // Cố tình không truyền fallback tĩnh: bản sao trong data/ chỉ dùng để seed
    // CMS, nó không đổi theo khi quản trị thay ảnh nên dùng làm dự phòng sẽ
    // hiển thị ảnh khác với admin. Không có dữ liệu thì ẩn hẳn khung ảnh.
    const slides = await fetchFromCMS('hero-slides?sort=sort_order:asc&pagination[limit]=100');
    if (!slides || slides.length === 0) {
        carousel.hidden = true;
        return;
    }
    carousel.classList.remove('is-loading');

    const slidesContainer = carousel.querySelectorAll('.carousel-slide');
    const dotsContainer = carousel.querySelector('.carousel-dots');

    let slidesHtml = '';
    let dotsHtml = '';
    slides.forEach((slide, i) => {
        slidesHtml += `
            <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
                <img src="${escapeHtml(slide.image_url)}"
                     alt="${escapeHtml(slide.image_alt || slide.title)}"
                     ${i > 0 ? 'loading="lazy"' : ''}>
                <div class="hero-image-overlay">
                    <span class="overlay-subtitle">${escapeHtml(slide.subtitle)}</span>
                    <span class="overlay-title">${escapeHtml(slide.title)}</span>
                </div>
            </div>
        `;
        dotsHtml += `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Ảnh ${i + 1}" aria-selected="${i === 0 ? 'true' : 'false'}"></button>`;
    });

    slidesContainer.forEach(s => s.remove());
    if (dotsContainer) dotsContainer.remove();

    const badge = carousel.querySelector('.hero-spec-badge');
    if (badge) {
        badge.insertAdjacentHTML('beforebegin', slidesHtml);
    } else {
        carousel.insertAdjacentHTML('afterbegin', slidesHtml);
    }

    carousel.insertAdjacentHTML('beforeend', `<div class="carousel-dots" role="tablist" aria-label="Chọn ảnh">${dotsHtml}</div>`);

    initHeroCarousel();
}

// ======================================================
// HERO CAROUSEL (unchanged logic)
// ======================================================
function initHeroCarousel() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots   = carousel.querySelectorAll('.carousel-dot');
    if (slides.length < 2) return;

    let current = 0;
    let timer;
    let paused = false;

    function goTo(idx) {
        slides[current].classList.remove('active');
        dots[current]?.classList.remove('active');
        dots[current]?.setAttribute('aria-selected', 'false');

        current = (idx + slides.length) % slides.length;

        slides[current].classList.add('active');
        dots[current]?.classList.add('active');
        dots[current]?.setAttribute('aria-selected', 'true');
    }

    function startTimer() {
        clearInterval(timer);
        if (!paused) {
            timer = setInterval(() => goTo(current + 1), 5000);
        }
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goTo(parseInt(dot.dataset.dot, 10));
            startTimer();
        });
    });

    carousel.addEventListener('mouseenter', () => { paused = true; clearInterval(timer); });
    carousel.addEventListener('mouseleave', () => { paused = false; startTimer(); });
    carousel.addEventListener('focusin', () => { paused = true; clearInterval(timer); });
    carousel.addEventListener('focusout', () => { paused = false; startTimer(); });

    startTimer();
}

// ======================================================
// INJECT SITE COMPONENTS (mobile CTA bar)
// ======================================================
function injectSiteComponents() {
    if (window.innerWidth <= 768 && !document.querySelector('.mobile-cta-bar')) {
        // Số gọi lấy từ link gọi điện prerender đã ghi sẵn trong HTML; khi CMS trả
        // lời, renderSiteSettings đổi mọi link tel: (kể cả nút này) theo số mới.
        const callHref = document.querySelector('a[href^="tel:"]')?.getAttribute('href') || '/contact';
        const bar = document.createElement('div');
        bar.className = 'mobile-cta-bar';
        bar.innerHTML = `
            <a href="${escapeHtml(callHref)}" class="mobile-cta-call">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                Gọi Ngay
            </a>
            <a href="/contact" class="mobile-cta-quote">Yêu Cầu Báo Giá</a>
        `;
        document.body.appendChild(bar);
    }
}

// ======================================================
// NAVBAR
// ======================================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('menu-toggle');
    const wrapper = document.querySelector('.nav-links-wrapper');

    if (navbar) {
        window.addEventListener('scroll', () => {
            const navbarWrapper = navbar.closest('.navbar-wrapper');
            if (navbarWrapper) {
                navbarWrapper.classList.toggle('scrolled', window.scrollY > 50);
            }
        }, { passive: true });
    }

    if (toggle && wrapper) {
        if (!wrapper.querySelector('.sidebar-header')) {
            const header = document.createElement('div');
            header.className = 'sidebar-header';
            header.textContent = 'MENU';
            wrapper.insertBefore(header, wrapper.firstChild);
        }

        let backdrop = document.querySelector('.menu-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'menu-backdrop';
            document.body.appendChild(backdrop);
        }

        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', 'nav-menu');
        wrapper.setAttribute('id', 'nav-menu');
        wrapper.setAttribute('aria-hidden', 'true');

        const closeMenu = () => {
            wrapper.classList.remove('mobile-open');
            toggle.classList.remove('active');
            backdrop.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
            wrapper.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('menu-open');
        };

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.toggle('mobile-open');
            toggle.classList.toggle('active', isOpen);
            backdrop.classList.toggle('active', isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            wrapper.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            document.body.classList.toggle('menu-open', isOpen);
        });

        backdrop.addEventListener('click', closeMenu);

        // Menu có thể được dựng lại từ CMS sau khi initNavbar chạy, nên bắt sự
        // kiện ở thùng chứa thay vì gắn vào từng link đang có.
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link') && !e.target.closest('.nav-submenu-toggle')) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && wrapper.classList.contains('mobile-open')) {
                closeMenu();
            }
        });
    }
}

// ======================================================
// THANH MENU ĐỘNG
// ======================================================

// Menu tĩnh trong HTML là bản dự phòng: chỉ thay thế khi CMS trả về dữ liệu
// dùng được, nên website không bao giờ mất điều hướng nếu CMS chết.
async function initNavigationMenu() {
    const list = document.querySelector('.nav-links');
    if (!list) return;

    let items = [];
    try {
        const res = await fetch(`${CMS_API}/navigation`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`CMS responded ${res.status}`);
        const json = await res.json();
        const record = json.data?.attributes || json.data;
        const raw = record?.items;
        items = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
    } catch (err) {
        console.warn('[CMS] Giữ menu tĩnh trong HTML:', err.message);
        initNavSubmenus(list);
        markActiveNavLink();
        return;
    }

    const html = renderNavItems(items);
    if (html) list.innerHTML = html;

    initNavSubmenus(list);
    markActiveNavLink();
}

// "//vi-du.vn" và "/\vi-du.vn" trông như đường dẫn trong website nhưng trình
// duyệt hiểu là một tên miền khác nên bị loại riêng — dễ thành link ra ngoài
// do gõ nhầm "//contact". Cùng quy tắc với safeUrl() trong
// scripts/prerender-site-settings.js.
function safeNavUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\/[/\\]/.test(raw)) return '';
    if (raw.startsWith('/') || raw.startsWith('#')) return raw;
    if (/^https?:\/\/\S+$/i.test(raw)) return raw;
    return '';
}

function renderNavItems(items) {
    if (!Array.isArray(items)) return '';

    const html = items
        .filter(item => item && item.visible !== false && String(item.label ?? '').trim() && safeNavUrl(item.url))
        .map(item => {
            const children = (Array.isArray(item.children) ? item.children : [])
                .filter(child => child && child.visible !== false && String(child.label ?? '').trim() && safeNavUrl(child.url));

            const link = `<a href="${escapeHtml(safeNavUrl(item.url))}" class="nav-link">${escapeHtml(item.label)}</a>`;
            if (!children.length) return `<li>${link}</li>`;

            const submenu = children
                .map(child => `<li><a href="${escapeHtml(safeNavUrl(child.url))}" class="nav-link nav-sublink">${escapeHtml(child.label)}</a></li>`)
                .join('');

            return `<li class="has-submenu">${link}` +
                `<button type="button" class="nav-submenu-toggle" aria-expanded="false" aria-label="Mở menu con ${escapeHtml(item.label)}">` +
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>` +
                `</button>` +
                `<ul class="nav-submenu">${submenu}</ul></li>`;
        })
        .join('');

    return html;
}

// Trên desktop menu con mở bằng hover (CSS); trên mobile cần bấm vào mũi tên.
// DOMContentLoaded và lời gọi trực tiếp có thể cùng chạy initNavigationMenu()
// trên cùng một menu (nhánh CMS lỗi không dựng lại DOM) — WeakSet chống gắn
// listener hai lần, để một cú bấm không mở rồi đóng ngay. Không dùng
// dataset/thuộc tính DOM vì test so khớp DOM giữa prerender và app.js sẽ vỡ
// nếu DOM có thêm thuộc tính.
const boundSubmenuToggles = new WeakSet();
function initNavSubmenus(list) {
    list.querySelectorAll('.nav-submenu-toggle').forEach(toggle => {
        if (boundSubmenuToggles.has(toggle)) return;
        boundSubmenuToggles.add(toggle);
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const parent = toggle.closest('.has-submenu');
            const isOpen = parent.classList.toggle('submenu-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });
}

function normalizeNavPath(path) {
    return String(path || '').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

// Trạng thái "đang xem" tính từ URL hiện tại thay vì các id cứng trong HTML,
// vì các mục menu giờ do quản trị đặt.
function markActiveNavLink() {
    const links = Array.from(document.querySelectorAll('.nav-links .nav-link'));
    if (!links.length) return;

    const currentPath = normalizeNavPath(window.location.pathname);
    const currentHash = window.location.hash || '';

    const candidates = links.map(link => {
        const href = link.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) return { link, score: 0 };

        const [rawPath, rawHash] = href.split('#');
        const linkPath = rawPath ? normalizeNavPath(rawPath) : currentPath;
        const linkHash = rawHash ? `#${rawHash}` : '';

        if (linkPath === currentPath && linkHash && linkHash === currentHash) return { link, score: 4 };
        if (linkPath === currentPath && !linkHash && !currentHash) return { link, score: 3 };
        if (linkPath === currentPath && !linkHash) return { link, score: 2 };
        if (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`)) return { link, score: 1 };
        return { link, score: 0 };
    });

    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));

    links.forEach(link => link.classList.remove('active'));
    if (best.score > 0) {
        best.link.classList.add('active');
        const parentItem = best.link.closest('.has-submenu');
        if (parentItem) parentItem.querySelector('.nav-link')?.classList.add('active');
    }
}

// ======================================================
// SCROLL-TO-TOP BUTTON
// ======================================================
function initScrollTopButton() {
    const btn = document.getElementById('scroll-top-btn');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('hidden', window.scrollY < 400);
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ======================================================
// DYNAMIC CONTENT ROUTING
// ======================================================
async function initDynamicContent() {
    // Thẻ sản phẩm lấy chữ thay cho giá và đơn vị mặc định từ cài đặt, nên phải
    // chờ cài đặt về trước, nếu không lần render đầu sẽ hiện chữ dự phòng.
    await loadSiteSettings();

    initMarketPrices();
    initSurveyPricing();
    initHomeNewsPreview();
    initHomeProducts();
    initServicesSection();
    initWorkflowSection();
    initProductsPage();
    initProductDetailPage();
    initNewsPage();
    initNewsDetailPage();
    initProjectsPage();
}

// ======================================================
// SERVICES SECTION — Dynamic from CMS
// ======================================================
async function initServicesSection() {
    const grid = document.querySelector('.services-grid');
    if (!grid) return;

    const services = await fetchWithSeedContent('services?sort=sort_order:asc&pagination[limit]=100', '/data/services.json');
    if (!services || services.length === 0) return;

    grid.innerHTML = services.map(svc => {
        const features = (Array.isArray(svc.features) ? svc.features : [])
            .map(f => `<li><span class="bullet">✓</span> ${escapeHtml(f)}</li>`)
            .join('');

        return `
            <a class="service-card card cursor-pointer" href="${escapeHtml(safeInternalUrl(svc.link_url || '#'))}">
                <div class="service-icon-box">
                    <svg class="service-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${escapeHtml(svc.icon_svg || '')}"></path>
                    </svg>
                </div>
                <h3 class="service-title">${escapeHtml(svc.title)}</h3>
                <p class="service-description">${escapeHtml(svc.description)}</p>
                ${features ? `<ul class="service-features">${features}</ul>` : ''}
                ${svc.link_text ? `<span class="service-link font-accent">${escapeHtml(svc.link_text)}</span>` : ''}
            </a>
        `;
    }).join('');
}

// ======================================================
// WORKFLOW SECTION — Dynamic from CMS
// ======================================================
async function initWorkflowSection() {
    const timeline = document.querySelector('.workflow-timeline');
    if (!timeline) return;

    const steps = await fetchWithSeedContent('workflow-steps?sort=sort_order:asc&pagination[limit]=100', '/data/workflow_steps.json');
    if (!steps || steps.length === 0) return;

    timeline.innerHTML = steps.map(step => `
        <div class="timeline-item">
            <div class="timeline-badge font-accent">${String(step.step_number).padStart(2, '0')}</div>
            <div class="timeline-panel card">
                <h3 class="step-title">${escapeHtml(step.title)}</h3>
                <p class="step-desc">${escapeHtml(step.description)}</p>
            </div>
        </div>
    `).join('');
}

// ======================================================
// MARKET PRICES TABLE
// ======================================================
async function initMarketPrices() {
    const homePriceBody    = document.getElementById('market-price-body');
    const pricingPriceBody = document.getElementById('pricing-table-body');
    if (!homePriceBody && !pricingPriceBody) return;

    try {
        // Không dùng bản sao tĩnh: giá kim loại đổi hằng ngày, hiển thị giá cũ
        // còn tệ hơn không hiển thị bảng giá nào.
        const prices = await fetchFromCMS('pricing-packages?pagination[limit]=100');
        if (!prices || prices.length === 0) return;

        const renderRow = (item, showDate) => {
            const trendClass = item.trend === 'up' ? 'trend-up' : 'trend-down';
            const trendIcon  = item.trend === 'up' ? '▲' : '▼';
            let row = `
                <tr>
                    <td><strong>${escapeHtml(item.metal)}</strong></td>
                    <td>${escapeHtml(item.lme_price)}</td>
                    <td>${escapeHtml(item.domestic_price)}${escapeHtml(item.unit)}</td>
                    <td class="${trendClass}">${trendIcon} ${escapeHtml(item.change)}</td>
            `;
            if (showDate) row += `<td>${escapeHtml(item.updated)}</td>`;
            row += '</tr>';
            return row;
        };

        if (homePriceBody) {
            homePriceBody.innerHTML = prices.map(p => renderRow(p, false)).join('');
        }
        if (pricingPriceBody) {
            pricingPriceBody.innerHTML = prices.map(p => renderRow(p, true)).join('');
        }
    } catch (e) {
        console.error('[Prices] Error:', e);
    }
}

// ======================================================
// PRICING — SURVEY FEES
// ======================================================
async function initSurveyPricing() {
    const body = document.getElementById('survey-pricing-table-body');
    if (!body) return;

    try {
        const surveys = await fetchFromCMS('pricing-surveys?pagination[limit]=100', '/data/pricing_survey.json');
        if (!surveys || surveys.length === 0) {
            body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem;">Chưa có biểu phí nào.</td></tr>';
            return;
        }

        body.innerHTML = surveys.map(item => `
            <tr>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td>${escapeHtml(item.price)}</td>
                <td>${escapeHtml(item.description)}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('[Survey Pricing] Error:', e);
        body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem;">Không thể tải biểu phí.</td></tr>';
    }
}

// ======================================================
// HOME — NEWS PREVIEW
// ======================================================
async function initHomeNewsPreview() {
    const grid = document.getElementById('home-news-grid');
    if (!grid) return;

    try {
        const news = await fetchFromCMS('news-articles?pagination[limit]=100&sort=date:desc', '/data/news.json');
        if (!news || news.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;">Chưa có tin tức nào.</div>';
            return;
        }

        const preview = news.slice(0, 3);
        grid.innerHTML = preview.map(item => buildNewsCard(item)).join('');
    } catch (e) {
        console.error('[News Preview]', e);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#666666;">Không thể tải tin tức.</div>';
    }
}

// ======================================================
// HOME — PRODUCTS
// ======================================================
async function initHomeProducts() {
    const grid = document.getElementById('home-products-grid');
    if (!grid) return;

    let allProducts = [];
    try {
        allProducts = await fetchFromCMS('products?sort=sort_order:asc&pagination[limit]=500', '/data/products.json');
    } catch (e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục sản phẩm.</p></div>';
        return;
    }

    if (!allProducts || allProducts.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có sản phẩm nào.</p></div>';
        return;
    }

    const tabsContainer = document.getElementById('home-filter-tabs');
    const categories = await resolveTabCategories(tabsContainer);
    renderCategoryTabs(tabsContainer, categories, allProducts, {
        buttonClass: 'home-filter-btn',
        wrapCount: false,
    });

    const render = (filter, searchVal = '') => {
        let filtered = allProducts.filter(product => productMatchesCategory(product, filter));

        if (searchVal) {
            const q = searchVal.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.grade && p.grade.toLowerCase().includes(q)) ||
                (p.description && p.description.toLowerCase().includes(q))
            );
        }

        const empty = document.getElementById('home-products-empty');
        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.removeAttribute('hidden');
        } else {
            if (empty) empty.setAttribute('hidden', '');
            grid.innerHTML = filtered.map(buildProductCard).join('');
        }
    };

    let activeFilter = 'all';
    render(activeFilter);

    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.home-filter-btn');
            if (!btn) return;
            activeFilter = btn.dataset.filter;
            document.querySelectorAll('.home-filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const searchInput = document.getElementById('home-search');
            render(activeFilter, searchInput ? searchInput.value.trim() : '');
        });
    }

    const searchInput = document.getElementById('home-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            render(activeFilter, searchInput.value.trim());
        });
    }
}

// ======================================================
// NEWS PAGE
// ======================================================
async function initNewsPage() {
    const grid = document.getElementById('news-full-grid');
    if (!grid) return;

    try {
        const news = await fetchFromCMS('news-articles?pagination[limit]=100&sort=date:desc', '/data/news.json');
        if (!news || news.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;">Chưa có tin tức nào.</div>';
            return;
        }
        grid.innerHTML = news.map(item => buildNewsCard(item, true)).join('');
    } catch (e) {
        console.error('[News Page]', e);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Không thể tải tin tức.</div>';
    }
}

// ======================================================
// NEWS DETAIL PAGE
// ======================================================
const ARTICLE_CATEGORY_LABELS = {
    'gia-ca': 'Giá Cả',
    'quoc-te': 'Quốc Tế',
    'noi-dia': 'Nội Địa',
    'phan-tich': 'Phân Tích',
    'cong-nghe': 'Công Nghệ',
};

// Thẻ và thuộc tính mà trình soạn thảo trong admin có thể sinh ra. Mọi thứ khác
// bị loại bỏ: nội dung tuy do người nhà nhập, nhưng nó đi qua CMS rồi mới được
// gắn vào trang bằng innerHTML, nên vẫn phải lọc trước khi hiển thị.
const ARTICLE_ALLOWED_TAGS = new Set([
    'P', 'BR', 'HR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'CODE', 'PRE',
    'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG',
    'FIGURE', 'FIGCAPTION', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);
// Những thẻ này bị xoá cả phần bên trong: giữ lại chữ trong <script>/<style>
// chỉ tạo ra một đống mã lộ thiên giữa bài viết.
const ARTICLE_DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT']);
const ARTICLE_ALLOWED_ATTRS = {
    A: ['href', 'title'],
    IMG: ['src', 'alt', 'title'],
};

function isSafeArticleUrl(value, { allowRelative = true } = {}) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    // "//vi-du.vn" là liên kết ra tên miền khác chứ không phải đường dẫn nội bộ.
    if (/^\/[/\\]/.test(raw)) return false;
    if (raw.startsWith('/') || raw.startsWith('#')) return allowRelative;
    return /^(https?:|mailto:|tel:)/i.test(raw);
}

// Bài viết cũ được lưu dưới dạng văn bản thuần với dấu xuống dòng (và có bài
// dùng gạch đầu dòng "- "). Hiển thị thẳng sẽ dồn thành một khối chữ liền, nên
// tách đoạn trước khi lọc HTML.
function articleContentToHtml(content) {
    const text = String(content ?? '').trim();
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) return text;

    return text
        .split(/\n{2,}/)
        .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function sanitizeArticleHtml(html) {
    const doc = new DOMParser().parseFromString(`<div id="root">${html || ''}</div>`, 'text/html');
    const root = doc.getElementById('root');

    root.querySelectorAll('*').forEach(el => {
        if (ARTICLE_DROPPED_TAGS.has(el.tagName)) {
            el.remove();
            return;
        }

        if (!ARTICLE_ALLOWED_TAGS.has(el.tagName)) {
            // Giữ lại phần chữ bên trong thẻ bị loại, để không mất nội dung khi
            // bài viết được dán từ nơi khác vào với thẻ lạ bọc ngoài.
            el.replaceWith(...el.childNodes);
            return;
        }

        const allowed = ARTICLE_ALLOWED_ATTRS[el.tagName] || [];
        [...el.attributes].forEach(attr => {
            if (!allowed.includes(attr.name.toLowerCase())) {
                el.removeAttribute(attr.name);
            }
        });

        if (el.tagName === 'A') {
            if (!isSafeArticleUrl(el.getAttribute('href'))) {
                el.removeAttribute('href');
            } else {
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener nofollow');
            }
        }

        if (el.tagName === 'IMG') {
            if (!isSafeArticleUrl(el.getAttribute('src'), { allowRelative: false })) {
                el.remove();
                return;
            }
            el.setAttribute('loading', 'lazy');
            el.classList.add('article-image');
        }
    });

    return root.innerHTML;
}

function formatArticleDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function setMetaContent(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.setAttribute('content', value);
}

// Địa chỉ chính thức là /tin-tuc/<duong-dan>. Dạng cũ /news-detail?slug=... vẫn
// được chấp nhận cho những link đã chia sẻ trước khi đổi (nginx cũng chuyển
// hướng 301, nhưng đọc được cả hai thì trang không phụ thuộc vào cấu hình đó).
function getArticleSlugFromLocation() {
    const match = window.location.pathname.match(/^\/tin-tuc\/(.+?)\/?$/);
    if (match) return decodeURIComponent(match[1]);
    return new URLSearchParams(window.location.search).get('slug');
}

function getArticleUrl(slug) {
    return `/tin-tuc/${encodeURIComponent(slug)}`;
}

async function initNewsDetailPage() {
    const contentEl = document.getElementById('news-detail-content');
    if (!contentEl) return;

    const slug = getArticleSlugFromLocation();
    const notFound = '<p style="text-align:center;padding:40px 0;">Không tìm thấy bài viết. <a href="/news">Quay lại trang tin tức</a>.</p>';

    if (!slug) {
        contentEl.innerHTML = notFound;
        return;
    }

    try {
        const news = await fetchFromCMS('news-articles?pagination[limit]=200&sort=date:desc', '/data/news.json');
        const article = (news || []).find(item => item.slug === slug);

        if (!article) {
            contentEl.innerHTML = notFound;
            return;
        }

        document.title = `${article.title} - DHA Minerals`;
        setMetaContent('page-desc', article.summary);
        setMetaContent('og-title', article.title);
        setMetaContent('og-desc', article.summary);
        setMetaContent('og-image', article.image);
        setMetaContent('og-url', `${window.location.origin}${getArticleUrl(article.slug)}`);

        // Hai địa chỉ cùng trỏ về một bài (dạng cũ và dạng mới), nên phải nói rõ
        // với công cụ tìm kiếm đâu là địa chỉ chính thức.
        const canonical = document.getElementById('canonical-url');
        if (canonical) canonical.href = `${window.location.origin}${getArticleUrl(article.slug)}`;

        const breadcrumb = document.getElementById('detail-breadcrumb');
        if (breadcrumb) breadcrumb.textContent = article.title;

        const catLabel = ARTICLE_CATEGORY_LABELS[article.category] || article.category || '';
        const coverUrl = toSiteAssetUrl(article.image);
        const cover = coverUrl ? `
            <figure class="article-cover">
                <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(article.title)}">
            </figure>` : '';

        contentEl.innerHTML = `
            <header class="article-header">
                ${catLabel ? `<span class="article-category">${escapeHtml(catLabel)}</span>` : ''}
                <h1 class="article-title">${escapeHtml(article.title)}</h1>
                <p class="article-meta">
                    <time datetime="${escapeHtml(article.date || '')}">${escapeHtml(formatArticleDate(article.date))}</time>
                </p>
                ${article.summary ? `<p class="article-summary">${escapeHtml(article.summary)}</p>` : ''}
            </header>
            ${cover}
            <div class="article-body">${sanitizeArticleHtml(articleContentToHtml(article.content))}</div>
            <p class="article-back"><a href="/news">← Xem tất cả tin tức</a></p>
        `;
    } catch (e) {
        console.error('[News Detail]', e);
        contentEl.innerHTML = '<p style="text-align:center;padding:40px 0;">Không thể tải bài viết. <a href="/news">Quay lại trang tin tức</a>.</p>';
    }
}

function buildNewsCard(item, fullWidth) {
    const catLabel = ARTICLE_CATEGORY_LABELS[item.category] || escapeHtml(item.category) || '';
    const dateStr = item.date ? new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    // Bài chưa có đường dẫn (dữ liệu cũ) vẫn hiển thị được, chỉ là không bấm vào
    // đọc tiếp được — thà thế còn hơn dẫn tới một trang chi tiết trống.
    const href = item.slug ? getArticleUrl(item.slug) : '';
    const body = `
        <div class="news-card-img-box">
            <img src="${escapeHtml(toSiteAssetUrl(item.image) || '/assets/mo_quang_ha_nam.png')}" alt="${escapeHtml(item.title)}" class="news-card-img" loading="lazy">
            ${catLabel ? `<span class="news-card-badge">${escapeHtml(catLabel)}</span>` : ''}
        </div>
        <div class="news-card-body">
            <span class="news-card-date">${escapeHtml(dateStr)}</span>
            <h3 class="news-card-title">${escapeHtml(item.title)}</h3>
            <p class="news-card-summary">${escapeHtml(item.summary)}</p>
            ${href ? '<span class="news-card-more">Đọc tiếp →</span>' : ''}
        </div>
    `;

    if (!href) {
        return `<article class="news-card card ${fullWidth ? 'news-card-full' : ''}">${body}</article>`;
    }

    return `
        <a href="${escapeHtml(href)}" class="news-card card ${fullWidth ? 'news-card-full' : ''}">
            ${body}
        </a>
    `;
}

// ======================================================
// PRODUCT CARD BUILDER
// ======================================================
function buildProductCard(product) {
    const inStock     = product.in_stock !== false;
    const { label: groupLabel, css: groupCss } = getProductBadge(product);
    const imgSrc      = escapeHtml(product.image || '/assets/phong_thi_nghiem_dha.png');
    const imgAlt      = escapeHtml(product.name || 'Sản phẩm');
    const priceLabel  = getProductPriceLabel(product);

    return `
        <a href="/product-detail?id=${encodeURIComponent(product.uid)}" class="product-card card"
             data-group="${escapeHtml(product.group)}"
             data-featured="${product.featured ? 'true' : 'false'}"
             data-stock="${inStock ? 'in' : 'out'}"
             data-name="${escapeHtml((product.name || '').toLowerCase())}"
             data-grade="${escapeHtml((product.grade || '').toLowerCase())}"
             data-origin="${escapeHtml((product.origin || '').toLowerCase())}">
            <div class="product-img-wrap">
                <img src="${imgSrc}" alt="${imgAlt}" class="product-img" loading="lazy">
                <span class="product-badge ${groupCss}">${escapeHtml(groupLabel)}</span>
                <span class="product-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">${inStock ? 'Còn Hàng' : 'Hết Hàng'}</span>
            </div>
            <div class="product-body">
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                ${product.grade ? `
                <div class="product-grade">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                    ${escapeHtml(product.grade)}
                </div>` : ''}
                ${product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : ''}
                ${product.origin ? `
                <div class="product-origin">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    ${escapeHtml(product.origin)}
                </div>` : ''}
                <div class="product-footer">
                    <span class="product-price ${priceLabel.isContact ? 'is-contact' : ''}">${escapeHtml(priceLabel.text)}</span>
                    <span class="product-cta-link">Xem chi tiết →</span>
                </div>
            </div>
        </a>
    `;
}

// ======================================================
// PRODUCTS PAGE
// ======================================================
async function initProductsPage() {
    const container = document.getElementById('products-container');
    if (!container) return;

    let allProducts = [];

    try {
        allProducts = await fetchFromCMS('products?sort=sort_order:asc&pagination[limit]=500', '/data/products.json');
    } catch (e) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục sản phẩm.</p></div>';
        return;
    }

    if (!allProducts || allProducts.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có sản phẩm nào.</p></div>';
        return;
    }

    const tabsContainer = document.getElementById('product-filter-tabs');
    const categories = await resolveTabCategories(tabsContainer);
    renderCategoryTabs(tabsContainer, categories, allProducts, {
        buttonClass: 'product-filter-btn',
        countClass: 'filter-count',
        wrapCount: true,
    });

    const urlParams = new URLSearchParams(window.location.search);
    const preFilter = urlParams.get('filter');

    const renderProducts = (filter) => {
        const filtered = allProducts.filter(product => productMatchesCategory(product, filter));

        const empty = document.getElementById('products-empty');
        if (filtered.length === 0) {
            container.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';
        container.innerHTML = filtered.map(buildProductCard).join('');
    };

    // Mã lọc trên URL có thể là mã cũ không còn tồn tại (bookmark, Google index
    // cũ) — chỉ dùng nó khi khớp đúng một tab đang có, nếu không thì về "Tất Cả"
    // và tô sáng đúng nút "Tất Cả" để tránh cảnh lưới trống dưới tab đang sáng.
    const filterButtons = [...document.querySelectorAll('.product-filter-btn')];
    const matched = !!preFilter && filterButtons.some(btn => btn.dataset.filter === preFilter);
    const initialFilter = matched ? preFilter : 'all';
    renderProducts(initialFilter);

    filterButtons.forEach(btn => {
        const isActive = btn.dataset.filter === initialFilter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.product-filter-btn');
            if (!btn) return;
            const filter = btn.dataset.filter;
            document.querySelectorAll('.product-filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            renderProducts(filter);
        });
    }
}

// ======================================================
// PRODUCT DETAIL PAGE
// ======================================================
async function initProductDetailPage() {
    const contentEl = document.getElementById('product-detail-content');
    if (!contentEl) return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;"><p>Không tìm thấy sản phẩm. <a href="/products">Quay lại danh mục</a>.</p></div>';
        return;
    }

    try {
        const products = await fetchFromCMS('products?pagination[limit]=500', '/data/products.json');
        const product = products.find(p => p.uid === productId);

        if (!product) {
            contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;"><p>Không tìm thấy sản phẩm. <a href="/products">Quay lại danh mục</a>.</p></div>';
            return;
        }

        document.title = `${escapeHtml(product.name)} - DHA Minerals`;
        const breadcrumb = document.getElementById('detail-breadcrumb');
        if (breadcrumb) breadcrumb.textContent = product.name;

        const { label: groupLabel, css: groupCss } = getProductBadge(product);
        const imgSrc = escapeHtml(product.image || '/assets/phong_thi_nghiem_dha.png');
        const inStock = product.in_stock !== false;
        const priceLabel = getProductPriceLabel(product);
        // Số gọi: theo cài đặt CMS; CMS lỗi thì lấy link gọi điện prerender đã ghi
        // sẵn trong HTML (đầu trang, chân trang) — không dùng số viết cứng nào.
        const settings = window.__siteSettings;
        const hotline = String(settings?.hotline || '').replace(/[.\s\-()]/g, '');
        const callHref = hotline
            ? `tel:${hotline}`
            : (document.querySelector('a[href^="tel:"]')?.getAttribute('href') || '/contact');

        let specsHtml = '';
        if (Array.isArray(product.specs)) {
            specsHtml = product.specs.map(spec => {
                const safe = escapeHtml(spec);
                const colonIdx = safe.indexOf(':');
                if (colonIdx > -1) {
                    return `<li><strong>${safe.substring(0, colonIdx)}:</strong> ${safe.substring(colonIdx + 1).trim()}</li>`;
                }
                return `<li>${safe}</li>`;
            }).join('');
        }

        // Quay về đúng danh mục đầu tiên của sản phẩm. `group` giờ chỉ lo nhãn
        // màu ở góc ảnh nên không dùng làm mã lọc được nữa.
        const [firstCategory] = getProductCategorySlugs(product);
        const backToCategoryHref = firstCategory
            ? `/products?filter=${encodeURIComponent(firstCategory)}`
            : '/products';

        contentEl.innerHTML = `
            <div class="detail-image-box">
                <img src="${imgSrc}" alt="${escapeHtml(product.name)}" class="detail-img">
                <span class="product-badge ${groupCss}" style="position:absolute;top:12px;left:12px;">${escapeHtml(groupLabel)}</span>
                <span class="product-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}" style="position:absolute;top:12px;right:12px;">${inStock ? 'Còn Hàng' : 'Hết Hàng'}</span>
            </div>
            <div class="detail-info">
                <h1 class="detail-title">${escapeHtml(product.name)}</h1>
                ${product.grade ? `<div class="detail-grade"><strong>Hàm lượng:</strong> ${escapeHtml(product.grade)}</div>` : ''}
                <div class="detail-price ${priceLabel.isContact ? 'is-contact' : ''}">
                    <span class="detail-price-label">${priceLabel.isContact ? 'Giá:' : 'Giá tham khảo:'}</span>
                    <strong>${escapeHtml(priceLabel.text)}</strong>
                </div>
                ${product.origin ? `<div class="detail-origin"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ${escapeHtml(product.origin)}</div>` : ''}
                <p class="detail-desc">${escapeHtml(product.description || '')}</p>
                ${specsHtml ? `
                <div class="detail-specs">
                    <h3 class="detail-specs-title">Thông Số Kỹ Thuật</h3>
                    <ul class="detail-specs-list">${specsHtml}</ul>
                </div>` : ''}
                    <div class="detail-cta-box">
                        <a href="${escapeHtml(callHref)}" class="btn-primary" style="flex:1;text-align:center;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:18px;height:18px;margin-right:6px;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                            Liên Hệ Nhận Báo Giá
                        </a>
                        <a href="${backToCategoryHref}" class="btn-secondary" style="flex:1;text-align:center;">← Quay Lại Danh Mục</a>
                    </div>
                    <form id="order-form" class="detail-order-form">
                        <h3 class="detail-specs-title">Gửi Yêu Cầu Đặt Mẫu</h3>
                        <div class="form-group-row">
                            <div class="form-group">
                                <label for="order-customer-name" class="form-label">Họ và Tên <span class="required">*</span></label>
                                <input id="order-customer-name" class="input" type="text" required>
                            </div>
                            <div class="form-group">
                                <label for="order-phone" class="form-label">Số Điện Thoại <span class="required">*</span></label>
                                <input id="order-phone" class="input" type="tel" required>
                            </div>
                        </div>
                        <div class="form-group-row">
                            <div class="form-group">
                                <label for="order-email" class="form-label">Email</label>
                                <input id="order-email" class="input" type="email">
                            </div>
                            <div class="form-group">
                                <label for="order-quantity" class="form-label">Số Lượng <span class="required">*</span></label>
                                <input id="order-quantity" class="input" type="number" min="0.01" step="0.01" value="1" required>
                            </div>
                        </div>
                        <div class="form-group-row">
                            <div class="form-group">
                                <label for="order-unit" class="form-label">Đơn Vị</label>
                                <select id="order-unit" class="input form-select">
                                    <option value="kg" selected>kg</option>
                                    <option value="tan">tấn</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="order-note" class="form-label">Ghi Chú</label>
                                <input id="order-note" class="input" type="text" placeholder="Quy cách, địa điểm giao hàng...">
                            </div>
                        </div>
                        <button type="submit" class="btn-primary w-full cursor-pointer btn-submit-order">Gửi Đơn Đặt Mẫu</button>
                    </form>
                </div>
            `;
            initProductOrderForm(product);
        } catch (e) {
            console.error('[Product Detail]', e);
            contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;"><p>Lỗi tải thông tin sản phẩm.</p></div>';
        }
    }

function initProductOrderForm(product) {
    const form = document.getElementById('order-form');
    if (!form || !product) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const product_name = product.name || '';
        const product_uid = product.uid || '';
        const customer_name = document.getElementById('order-customer-name')?.value?.trim();
        const phone = document.getElementById('order-phone')?.value?.trim();
        const email = document.getElementById('order-email')?.value?.trim();
        const quantity = Number(document.getElementById('order-quantity')?.value || 0);
        const unit = document.getElementById('order-unit')?.value || 'kg';
        const note = document.getElementById('order-note')?.value?.trim();

        if (!product_name || !customer_name || !phone || quantity <= 0) {
            alert('Vui lòng nhập Họ tên, Số điện thoại và Số lượng hợp lệ.');
            return;
        }

        const submitBtn = form.querySelector('.btn-submit-order');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang gửi...';
        }

        try {
            const res = await fetch(`${CMS_API}/order-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { product_name, product_uid, customer_name, phone, email, quantity, unit, note },
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) throw new Error(`Server responded ${res.status}`);
            alert('Đã gửi đơn đặt mẫu. DHA sẽ liên hệ xác nhận trong thời gian sớm nhất.');
            form.reset();
        } catch {
            alert('Chưa gửi được đơn đặt mẫu. Vui lòng gọi hotline hoặc thử lại sau ít phút.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Gửi Đơn Đặt Mẫu';
            }
        }
    });
}

// ======================================================
// CONTACT FORM
// ======================================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    initContactServices();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name    = document.getElementById('contact-name')?.value?.trim();
        const phone   = document.getElementById('contact-phone')?.value?.trim();
        const email   = document.getElementById('contact-email')?.value?.trim();
        const address = document.getElementById('contact-address')?.value?.trim();
        // Mã lạ hoặc rỗng thì CMS tự chốt về mục đầu danh sách Nhu cầu.
        const service = document.getElementById('contact-service')?.value || '';
        const message = document.getElementById('contact-message')?.value?.trim();

        if (!name || !phone || !address) {
            alert('Vui lòng nhập đầy đủ Họ tên, Số điện thoại và Địa chỉ.');
            return;
        }

        const submitBtn = form.querySelector('.btn-submit-contact');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang gửi...';
        }

        try {
            const res = await fetch(`${CMS_API}/contact-inquiries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { name, phone, email, address, service, message } }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) throw new Error(`Server responded ${res.status}`);
        } catch {
            alert('Chưa gửi được yêu cầu. Vui lòng gọi hotline hoặc thử lại sau ít phút.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Gửi Yêu Cầu Báo Giá';
            }
            return;
        }

        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const closeBtn = document.getElementById('modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.add('hidden');
                }, { once: true });
            }
            modal.addEventListener('click', (ev) => {
                if (ev.target === modal) modal.classList.add('hidden');
            }, { once: true });
        }

        form.reset();

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi Yêu Cầu Báo Giá';
        }
    });
}

// ======================================================
// ESTIMATOR (Cost Calculator) — option và con số từ CMS
// ======================================================
// Mọi con số dùng để tính nằm trong DOM: data-price của từng option và của ô
// CO, data-bulk-* của form. Prerender đã ghi sẵn bản mới nhất; khi CMS trả lời,
// các hàm dưới đây dựng lại ra đúng cùng một DOM (xem applyFormsToHtml trong
// scripts/prerender-site-settings.js). CMS lỗi thì giữ nguyên HTML.

// "đ/kg", "VNĐ / KG"... đều tính theo kg; "đ/tấn" thì không nhân với số kg được.
function isPerKgUnit(unit) {
    return /\/kg$/i.test(String(unit ?? '').replace(/\s+/g, ''));
}

// Cùng quy tắc với pickEstimatorOres() của prerender: sản phẩm có giá theo kg,
// nhóm theo danh mục đang hiện, bỏ nhóm không có quặng nào.
function pickEstimatorOres(products, categories, settings = {}) {
    const priced = (Array.isArray(products) ? products : [])
        .map((product, index) => ({ product, index }))
        .filter(({ product }) => {
            if (!product || product.price_on_request) return false;
            if (!(Number(product.price) > 0) || !product.uid || !String(product.name ?? '').trim()) return false;
            return isPerKgUnit(firstFilled(product.price_unit, settings?.price_unit_default, 'đ/kg'));
        })
        .sort((a, b) => (Number(a.product.sort_order) || 0) - (Number(b.product.sort_order) || 0) || a.index - b.index)
        .map(({ product }) => product);

    return (categories || [])
        .map(category => ({
            slug: category.slug,
            name: category.name,
            ores: priced
                .filter(product => Array.isArray(product.categories) && product.categories.includes(category.slug))
                .map(product => ({ uid: product.uid, name: product.name, price: Math.round(Number(product.price)) })),
        }))
        .filter(group => group.ores.length);
}

function renderEstimatorGroups(groups) {
    return groups.map(group => `<option value="${escapeHtml(group.slug)}">${escapeHtml(group.name)}</option>`).join('');
}

// Quặng của mọi nhóm nằm chung một ô; quặng ngoài nhóm đầu mang hidden.
function renderEstimatorOres(groups) {
    const first = groups[0]?.slug;
    return groups
        .flatMap(group => group.ores.map(ore =>
            `<option value="${escapeHtml(ore.uid)}" data-group="${escapeHtml(group.slug)}" data-price="${ore.price}"`
            + `${group.slug === first ? '' : ' hidden'}>${escapeHtml(ore.name)}</option>`
        ))
        .join('');
}

function renderAnalysisOptions(analyses) {
    return (Array.isArray(analyses) ? analyses : [])
        .filter(item => item && Number(item.price) > 0)
        .map(item => {
            const price = Math.round(Number(item.price));
            return `<option value="${escapeHtml(item.id ?? item.name)}" data-price="${price}">`
                + `${escapeHtml(item.name)} — ${price.toLocaleString('vi-VN')}đ</option>`;
        })
        .join('');
}

function renderPackagingOptions(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => `<option value="${escapeHtml(item.code)}" data-price="${Math.round(Number(item.price))}">${escapeHtml(item.name)}</option>`)
        .join('');
}

function renderContactServices(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`)
        .join('');
}

// Số hợp lệ mới ghi; không thì giữ giá trị mặc định đang nằm trong HTML.
function numberAttr(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : null;
}

function configText(config, key) {
    const value = config && typeof config[key] === 'string' ? config[key].trim() : '';
    return value || null;
}

function validFormRows(items) {
    return Array.isArray(items) ? items.filter(item => item && item.code) : [];
}

// Cấu hình "Dự toán & Liên hệ" dùng chung cho hai form — gọi CMS một lần.
let formConfigPromise = null;

function loadFormConfig() {
    if (!formConfigPromise) formConfigPromise = fetchSingleFromCMS('form-config');
    return formConfigPromise;
}

// Nhóm và quặng chỉ dựng lại khi cả danh mục lẫn sản phẩm đến từ CMS thật:
// trộn danh mục dự phòng với sản phẩm thật là ra nhóm sai.
function applyEstimatorData({ categories = null, products = null, analyses = null, formConfig = null, settings = null }) {
    const config = formConfig || {};
    const doc = document;

    const groups = categories && products ? pickEstimatorOres(products, categories, settings || {}) : [];
    const groupSelect = doc.getElementById('est-group');
    const oreSelect = doc.getElementById('est-ore');
    if (groups.length && groupSelect && oreSelect) {
        groupSelect.innerHTML = renderEstimatorGroups(groups);
        oreSelect.innerHTML = renderEstimatorOres(groups);
    }

    const methodSelect = doc.getElementById('est-method');
    const analysisRows = renderAnalysisOptions(analyses);
    const noAnalysisLabel = configText(config, 'no_analysis_label');
    const rawOption = methodSelect?.querySelector('option[value="raw"]');
    if (methodSelect && analysisRows) {
        const label = noAnalysisLabel ?? rawOption?.textContent ?? '';
        methodSelect.innerHTML = `<option value="raw">${escapeHtml(label)}</option>${analysisRows}`;
    } else if (rawOption && noAnalysisLabel) {
        rawOption.textContent = noAnalysisLabel;
    }

    const packaging = validFormRows(config.packaging);
    const packSelect = doc.getElementById('est-pack');
    if (packSelect && packaging.length) packSelect.innerHTML = renderPackagingOptions(packaging);

    const coPrice = numberAttr(config.co_price);
    const permit = doc.getElementById('est-permit');
    if (permit && coPrice) permit.setAttribute('data-price', coPrice);

    const coLabel = configText(config, 'co_label');
    if (coLabel) doc.querySelectorAll('[data-form-text="co_label"]').forEach(el => { el.textContent = coLabel; });

    const form = doc.getElementById('calculator-form');
    const threshold = numberAttr(config.bulk_threshold_kg);
    const percent = numberAttr(config.bulk_discount_percent);
    if (form && threshold) form.setAttribute('data-bulk-threshold', threshold);
    if (form && percent) form.setAttribute('data-bulk-percent', percent);
}

// Đổi nhóm: chỉ hiện quặng của nhóm đó, chọn quặng đầu tiên nếu quặng đang
// chọn bị ẩn. Chọn bằng option.selected vì một sản phẩm thuộc hai danh mục có
// hai option trùng value.
function filterEstimatorOres() {
    const group = document.getElementById('est-group')?.value;
    const oreSelect = document.getElementById('est-ore');
    if (!oreSelect) return;
    let firstVisible = null;
    [...oreSelect.options].forEach(option => {
        const visible = option.dataset.group === group;
        option.hidden = !visible;
        if (visible && !firstVisible) firstVisible = option;
    });
    const selected = oreSelect.options[oreSelect.selectedIndex];
    if (firstVisible && (!selected || selected.hidden)) firstVisible.selected = true;
}

function selectedOptionOf(id) {
    const select = document.getElementById(id);
    return select ? select.options[select.selectedIndex] : null;
}

function readPrice(el) {
    const price = Number(el?.dataset?.price);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

function computeEstimate(form) {
    const weight = Math.max(1, parseInt(document.getElementById('est-weight')?.value) || 10);
    const orePrice = readPrice(selectedOptionOf('est-ore'));
    const method = selectedOptionOf('est-method');
    const analysisCost = method?.value === 'raw' ? 0 : readPrice(method);
    const permit = document.getElementById('est-permit');
    const packCost = readPrice(selectedOptionOf('est-pack')) + (permit?.checked ? readPrice(permit) : 0);

    const oreCost = orePrice * weight;
    const threshold = Number(form.dataset.bulkThreshold);
    const percent = Number(form.dataset.bulkPercent);
    const discount = threshold > 0 && percent > 0 && weight >= threshold
        ? Math.round(oreCost * percent / 100)
        : 0;

    return { weight, orePrice, oreCost, analysisCost, packCost, discount, total: oreCost + analysisCost + packCost - discount };
}

function showEstimate(result) {
    const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';

    document.getElementById('result-total').textContent = fmt(result.total);
    document.getElementById('result-total-weight').textContent = result.weight + ' kg';
    document.getElementById('result-avg-price').textContent = fmt(result.orePrice) + '/kg';
    document.getElementById('result-ore-cost').textContent = fmt(result.oreCost);
    document.getElementById('result-analysis-cost').textContent = fmt(result.analysisCost);
    document.getElementById('result-pack-cost').textContent = fmt(result.packCost);

    const discountRow = document.getElementById('result-discount')?.closest('.detail-item');
    if (discountRow) {
        if (result.discount > 0) {
            discountRow.classList.remove('hidden');
            document.getElementById('result-discount').textContent = '-' + fmt(result.discount);
        } else {
            discountRow.classList.add('hidden');
        }
    }

    document.getElementById('result-placeholder')?.classList.add('hidden');
    document.getElementById('result-content')?.classList.remove('hidden');
}

// Gắn sự kiện một lần dù initEstimator được gọi lại.
const boundEstimatorForms = new WeakSet();

async function initEstimator() {
    const form = document.getElementById('calculator-form');
    if (!form) return;

    if (!boundEstimatorForms.has(form)) {
        boundEstimatorForms.add(form);
        document.getElementById('est-group')?.addEventListener('change', filterEstimatorOres);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            showEstimate(computeEstimate(form));
        });
    }

    // Sản phẩm và biểu phí không có file dự phòng: lỗi thì trả [] và HTML giữ nguyên.
    const [categoryResult, products, analyses, formConfig, settings] = await Promise.all([
        loadProductCategories(),
        fetchFromCMS('products?sort=sort_order:asc&pagination[limit]=500'),
        fetchFromCMS('pricing-analyses?pagination[limit]=100'),
        loadFormConfig(),
        loadSiteSettings(),
    ]);

    applyEstimatorData({
        categories: categoryResult.fromCMS ? categoryResult.categories : null,
        products,
        analyses,
        formConfig,
        settings,
    });
}

// Ô Nhu cầu của form Liên hệ.
async function initContactServices() {
    const select = document.getElementById('contact-service');
    if (!select) return;
    const services = validFormRows((await loadFormConfig())?.contact_services);
    if (services.length) select.innerHTML = renderContactServices(services);
}

// ======================================================
// PROJECTS PAGE
// ======================================================
async function initProjectsPage() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    try {
        const projects = await fetchFromCMS('projects?sort=publishedAt:desc&pagination[limit]=100', '/data/projects.json');
        if (!projects || projects.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có dự án nào.</p></div>';
            return;
        }

        container.innerHTML = projects.map(item => {
            const imageUrl = getProjectImageUrl(item) || '/assets/mo_quang_ha_nam.png';
            return `
            <div class="portfolio-item card">
                <div class="portfolio-img-wrap">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" class="portfolio-img" loading="lazy">
                </div>
                <div class="portfolio-body">
                    <h3 class="portfolio-name">${escapeHtml(item.name)}</h3>
                    <div class="portfolio-meta"><strong>Địa điểm:</strong> ${escapeHtml(item.location)}</div>
                    <div class="portfolio-meta"><strong>Quy mô:</strong> ${escapeHtml(item.scale)}</div>
                    <div class="portfolio-meta"><strong>Phương pháp:</strong> ${escapeHtml(item.method)}</div>
                    ${item.value ? `<div class="portfolio-meta"><strong>Kết quả:</strong> ${escapeHtml(item.value)}</div>` : ''}
                </div>
            </div>
        `;
        }).join('');
    } catch (e) {
        console.error('[Projects] Error:', e);
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục dự án.</p></div>';
    }
}

// Đặt ở cuối file: chạy ngay khi trình duyệt nạp xong app.js, nhưng sau khi mọi
// hằng và hàm phía trên đã khởi tạo.
applyCachedSiteSettings();
