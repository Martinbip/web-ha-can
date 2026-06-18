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

// ── Estimator pricing data ──
const ESTIMATOR_PRICES = {
    ore: {
        'copper-ore': { name: 'Quặng Đồng Chalcopyrite', price: 85000 },
        'bauxite-ore': { name: 'Quặng Bauxit Nhôm', price: 35000 },
        'lead-zinc-ore': { name: 'Quặng Chì - Kẽm Galena', price: 65000 },
        'iron-ore': { name: 'Quặng Sắt Magnetite', price: 25000 },
        'manganese-ore': { name: 'Quặng Mangan', price: 45000 },
        'rare-earth-ore': { name: 'Quặng Đất Hiếm', price: 320000 },
    },
    analysis: {
        'raw': { name: 'Không phân tích', price: 0 },
        'xrf': { name: 'Phân tích XRF', price: 1500000 },
        'icp': { name: 'Phân tích ICP-MS', price: 3500000 },
        'flotation': { name: 'Thử nghiệm tuyển khoáng', price: 8000000 },
    },
    packaging: {
        'box': { name: 'Hộp nhựa kín khí', price: 150000 },
        'bag': { name: 'Bao chống ẩm', price: 250000 },
        'barrel': { name: 'Thùng phuy bảo quản', price: 800000 },
    },
    permit: 500000,
    bulkDiscountThreshold: 500,
    bulkDiscountRate: 0.05,
};

// ======================================================
// CMS DATA FETCHING
// ======================================================
async function fetchFromCMS(endpoint, fallbackFile) {
    try {
        const res = await fetch(`${CMS_API}/${endpoint}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`CMS responded ${res.status}`);
        const json = await res.json();
        return (json.data || []).map(item => item.attributes || item);
    } catch {
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

// ======================================================
// DOMContentLoaded — MAIN ENTRY
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initScrollTopButton();
    initHeroCarousel();
    initDynamicContent();
    initContactForm();
    initEstimator();
    injectSiteComponents();
});

// ======================================================
// INJECT SITE COMPONENTS (mobile CTA bar, robots/sitemap notice)
// ======================================================
function injectSiteComponents() {
    if (window.innerWidth <= 768 && !document.querySelector('.mobile-cta-bar')) {
        const bar = document.createElement('div');
        bar.className = 'mobile-cta-bar';
        bar.innerHTML = `
            <a href="tel:0981234567" class="mobile-cta-call">
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

        wrapper.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && wrapper.classList.contains('mobile-open')) {
                closeMenu();
            }
        });
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
// HERO CAROUSEL
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
// DYNAMIC CONTENT ROUTING
// ======================================================
function initDynamicContent() {
    initMarketPrices();
    initHomeNewsPreview();
    initHomeProducts();
    initProductsPage();
    initProductDetailPage();
    initNewsPage();
    initProjectsPage();
}

// ======================================================
// MARKET PRICES TABLE
// ======================================================
async function initMarketPrices() {
    const homePriceBody    = document.getElementById('market-price-body');
    const pricingPriceBody = document.getElementById('pricing-table-body');
    if (!homePriceBody && !pricingPriceBody) return;

    try {
        const prices = await fetchFromCMS('pricing-packages', 'data/pricing_packages.json');
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
// HOME — NEWS PREVIEW
// ======================================================
async function initHomeNewsPreview() {
    const grid = document.getElementById('home-news-grid');
    if (!grid) return;

    try {
        const news = await fetchFromCMS('news', 'data/news.json');
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
        allProducts = await fetchFromCMS('products?sort=sort_order:asc', 'data/products.json');
    } catch (e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục sản phẩm.</p></div>';
        return;
    }

    if (!allProducts || allProducts.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có sản phẩm nào.</p></div>';
        return;
    }

    const isColorMetal = (p) => ['dong', 'nhom', 'chi', 'thiec'].includes(p.group) || p.uid === 'quang-dong-tho';
    const isBlackMetal = (p) => p.group === 'quang' && (p.uid.includes('sat') || p.name.toLowerCase().includes('sắt'));
    const isRareEarth  = (p) => p.group === 'rare-earth' || p.uid.includes('dat-hiem') || p.name.toLowerCase().includes('đất hiếm');

    const counts = {
        all: allProducts.length,
        'color-metal': allProducts.filter(isColorMetal).length,
        'black-metal': allProducts.filter(isBlackMetal).length,
        'rare-earth': allProducts.filter(isRareEarth).length
    };

    ['all', 'color-metal', 'black-metal', 'rare-earth'].forEach(key => {
        const el = document.getElementById(`hcount-${key}`);
        if (el) el.textContent = `(${counts[key] || 0})`;
    });

    const render = (filter, searchVal = '') => {
        let filtered = allProducts;

        if (filter === 'color-metal') {
            filtered = allProducts.filter(isColorMetal);
        } else if (filter === 'black-metal') {
            filtered = allProducts.filter(isBlackMetal);
        } else if (filter === 'rare-earth') {
            filtered = allProducts.filter(isRareEarth);
        }

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

    const tabsContainer = document.getElementById('home-filter-tabs');
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
        const news = await fetchFromCMS('news', 'data/news.json');
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

function buildNewsCard(item, fullWidth) {
    const categoryLabels = {
        'gia-ca': 'Giá Cả',
        'quoc-te': 'Quốc Tế',
        'noi-dia': 'Nội Địa',
    };
    const catLabel = categoryLabels[item.category] || escapeHtml(item.category) || '';
    const dateStr = item.date ? new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    return `
        <article class="news-card card ${fullWidth ? 'news-card-full' : ''}">
            <div class="news-card-img-box">
                <img src="${escapeHtml(item.image || 'assets/mo_quang_ha_nam.png')}" alt="${escapeHtml(item.title)}" class="news-card-img" loading="lazy">
                ${catLabel ? `<span class="news-card-badge">${escapeHtml(catLabel)}</span>` : ''}
            </div>
            <div class="news-card-body">
                <span class="news-card-date">${escapeHtml(dateStr)}</span>
                <h3 class="news-card-title">${escapeHtml(item.title)}</h3>
                <p class="news-card-summary">${escapeHtml(item.summary)}</p>
            </div>
        </article>
    `;
}

// ======================================================
// PRODUCT CARD BUILDER
// ======================================================
function buildProductCard(product) {
    const inStock     = product.in_stock !== false;
    const groupLabel  = GROUP_LABEL[product.group] || escapeHtml(product.group);
    const groupCss    = GROUP_CSS[product.group] || '';
    const imgSrc      = escapeHtml(product.image || 'assets/phong_thi_nghiem_dha.png');
    const imgAlt      = escapeHtml(product.name || 'Sản phẩm');

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
        allProducts = await fetchFromCMS('products?sort=sort_order:asc', 'data/products.json');
    } catch (e) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục sản phẩm.</p></div>';
        return;
    }

    if (!allProducts || allProducts.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có sản phẩm nào.</p></div>';
        return;
    }

    const counts = { all: allProducts.length };
    allProducts.forEach(p => { counts[p.group] = (counts[p.group] || 0) + 1; });
    ['all', 'dong', 'nhom', 'chi', 'thiec', 'quang'].forEach(key => {
        const el = document.getElementById(`count-${key}`);
        if (el) el.textContent = counts[key] || 0;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const preFilter = urlParams.get('filter');

    const renderProducts = (filter) => {
        let filtered = allProducts;

        if (filter === 'color-metal') {
            filtered = allProducts.filter(p => ['dong', 'nhom', 'chi', 'thiec'].includes(p.group) || p.uid === 'quang-dong-tho');
        } else if (filter === 'black-metal') {
            filtered = allProducts.filter(p => p.group === 'quang' && (p.uid.includes('sat') || p.name.toLowerCase().includes('sắt')));
        } else if (filter === 'rare-earth') {
            filtered = allProducts.filter(p => p.group === 'rare-earth' || p.uid.includes('dat-hiem') || p.name.toLowerCase().includes('đất hiếm'));
        } else if (filter !== 'all') {
            filtered = allProducts.filter(p => p.group === filter);
        }

        const empty = document.getElementById('products-empty');
        if (filtered.length === 0) {
            container.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';
        container.innerHTML = filtered.map(buildProductCard).join('');
    };

    const initialFilter = preFilter || 'all';
    renderProducts(initialFilter);

    if (preFilter) {
        let matched = false;
        document.querySelectorAll('.product-filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === preFilter;
            if (isActive) matched = true;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        if (!matched) {
            const allBtn = document.querySelector('.product-filter-btn[data-filter="all"]');
            if (allBtn) {
                allBtn.classList.add('active');
                allBtn.setAttribute('aria-selected', 'true');
            }
        }
    }

    const tabsContainer = document.getElementById('product-filter-tabs');
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
        const products = await fetchFromCMS('products', 'data/products.json');
        const product = products.find(p => p.uid === productId);

        if (!product) {
            contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;"><p>Không tìm thấy sản phẩm. <a href="/products">Quay lại danh mục</a>.</p></div>';
            return;
        }

        document.title = `${escapeHtml(product.name)} - DHA Minerals`;
        const breadcrumb = document.getElementById('detail-breadcrumb');
        if (breadcrumb) breadcrumb.textContent = product.name;

        const groupLabel = GROUP_LABEL[product.group] || escapeHtml(product.group);
        const groupCss   = GROUP_CSS[product.group] || '';
        const imgSrc = escapeHtml(product.image || 'assets/phong_thi_nghiem_dha.png');
        const inStock = product.in_stock !== false;

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

        contentEl.innerHTML = `
            <div class="detail-image-box">
                <img src="${imgSrc}" alt="${escapeHtml(product.name)}" class="detail-img">
                <span class="product-badge ${groupCss}" style="position:absolute;top:12px;left:12px;">${escapeHtml(groupLabel)}</span>
                <span class="product-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}" style="position:absolute;top:12px;right:12px;">${inStock ? 'Còn Hàng' : 'Hết Hàng'}</span>
            </div>
            <div class="detail-info">
                <h1 class="detail-title">${escapeHtml(product.name)}</h1>
                ${product.grade ? `<div class="detail-grade"><strong>Hàm lượng:</strong> ${escapeHtml(product.grade)}</div>` : ''}
                ${product.origin ? `<div class="detail-origin"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ${escapeHtml(product.origin)}</div>` : ''}
                <p class="detail-desc">${escapeHtml(product.description || '')}</p>
                ${specsHtml ? `
                <div class="detail-specs">
                    <h3 class="detail-specs-title">Thông Số Kỹ Thuật</h3>
                    <ul class="detail-specs-list">${specsHtml}</ul>
                </div>` : ''}
                <div class="detail-cta-box">
                    <a href="tel:0981234567" class="btn-primary" style="flex:1;text-align:center;">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:18px;height:18px;margin-right:6px;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        Liên Hệ Nhận Báo Giá
                    </a>
                    <a href="/products?filter=${encodeURIComponent(product.group)}" class="btn-secondary" style="flex:1;text-align:center;">← Quay Lại Danh Mục</a>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('[Product Detail]', e);
        contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;"><p>Lỗi tải thông tin sản phẩm.</p></div>';
    }
}

// ======================================================
// CONTACT FORM
// ======================================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name    = document.getElementById('contact-name')?.value?.trim();
        const phone   = document.getElementById('contact-phone')?.value?.trim();
        const message = document.getElementById('contact-message')?.value?.trim();

        if (!name || !phone) {
            alert('Vui lòng nhập đầy đủ Họ tên và Số điện thoại.');
            return;
        }

        const submitBtn = form.querySelector('.btn-submit-contact');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang gửi...';
        }

        try {
            const res = await fetch(`${CMS_API}/contact-submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: { name, phone, message } }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) throw new Error(`Server responded ${res.status}`);
        } catch {
            console.warn('[Contact] CMS submission failed, saving to localStorage as fallback');
            const pending = JSON.parse(localStorage.getItem('dha_pending_contacts') || '[]');
            pending.push({ name, phone, message, date: new Date().toISOString() });
            localStorage.setItem('dha_pending_contacts', JSON.stringify(pending));
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
// ESTIMATOR (Cost Calculator)
// ======================================================
function initEstimator() {
    const form = document.getElementById('calculator-form');
    if (!form) return;

    const groupSelect = document.getElementById('est-group');
    const oreSelect = document.getElementById('est-ore');

    const oreOptions = {
        'color-metal': [
            { value: 'copper-ore', label: 'Quặng Đồng Chalcopyrite' },
            { value: 'bauxite-ore', label: 'Quặng Bauxit Nhôm' },
            { value: 'lead-zinc-ore', label: 'Quặng Chì - Kẽm Galena' },
        ],
        'black-metal': [
            { value: 'iron-ore', label: 'Quặng Sắt Magnetite' },
            { value: 'manganese-ore', label: 'Quặng Mangan' },
        ],
        'rare-earth': [
            { value: 'rare-earth-ore', label: 'Quặng Đất Hiếm' },
        ],
    };

    if (groupSelect && oreSelect) {
        groupSelect.addEventListener('change', () => {
            const options = oreOptions[groupSelect.value] || [];
            oreSelect.innerHTML = options.map(o =>
                `<option value="${o.value}">${o.label}</option>`
            ).join('');
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const oreType = oreSelect?.value || 'copper-ore';
        const weight = Math.max(1, parseInt(document.getElementById('est-weight')?.value) || 10);
        const method = document.getElementById('est-method')?.value || 'raw';
        const pack = document.getElementById('est-pack')?.value || 'box';
        const needPermit = document.getElementById('est-permit')?.checked ?? false;

        const oreInfo = ESTIMATOR_PRICES.ore[oreType] || ESTIMATOR_PRICES.ore['copper-ore'];
        const analysisInfo = ESTIMATOR_PRICES.analysis[method] || ESTIMATOR_PRICES.analysis['raw'];
        const packInfo = ESTIMATOR_PRICES.packaging[pack] || ESTIMATOR_PRICES.packaging['box'];

        const oreCost = oreInfo.price * weight;
        const analysisCost = analysisInfo.price;
        const packCost = packInfo.price + (needPermit ? ESTIMATOR_PRICES.permit : 0);

        let subtotal = oreCost + analysisCost + packCost;
        let discount = 0;

        if (weight >= ESTIMATOR_PRICES.bulkDiscountThreshold) {
            discount = Math.round(oreCost * ESTIMATOR_PRICES.bulkDiscountRate);
            subtotal -= discount;
        }

        const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';

        document.getElementById('result-total').textContent = fmt(subtotal);
        document.getElementById('result-total-weight').textContent = weight + ' kg';
        document.getElementById('result-avg-price').textContent = fmt(oreInfo.price) + '/kg';
        document.getElementById('result-ore-cost').textContent = fmt(oreCost);
        document.getElementById('result-analysis-cost').textContent = fmt(analysisCost);
        document.getElementById('result-pack-cost').textContent = fmt(packCost);

        const discountRow = document.getElementById('result-discount')?.closest('.detail-item');
        if (discountRow) {
            if (discount > 0) {
                discountRow.classList.remove('hidden');
                document.getElementById('result-discount').textContent = '-' + fmt(discount);
            } else {
                discountRow.classList.add('hidden');
            }
        }

        document.getElementById('result-placeholder')?.classList.add('hidden');
        document.getElementById('result-content')?.classList.remove('hidden');
    });
}

// ======================================================
// PROJECTS PAGE
// ======================================================
async function initProjectsPage() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    try {
        const projects = await fetchFromCMS('projects', 'data/projects.json');
        if (!projects || projects.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Chưa có dự án nào.</p></div>';
            return;
        }

        container.innerHTML = projects.map(item => `
            <div class="portfolio-item card">
                <div class="portfolio-img-wrap">
                    <img src="${escapeHtml(item.image || 'assets/mo_quang_ha_nam.png')}" alt="${escapeHtml(item.name)}" class="portfolio-img" loading="lazy">
                </div>
                <div class="portfolio-body">
                    <h3 class="portfolio-name">${escapeHtml(item.name)}</h3>
                    <div class="portfolio-meta"><strong>Địa điểm:</strong> ${escapeHtml(item.location)}</div>
                    <div class="portfolio-meta"><strong>Quy mô:</strong> ${escapeHtml(item.scale)}</div>
                    <div class="portfolio-meta"><strong>Phương pháp:</strong> ${escapeHtml(item.method)}</div>
                    ${item.value ? `<div class="portfolio-meta"><strong>Kết quả:</strong> ${escapeHtml(item.value)}</div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('[Projects] Error:', e);
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục dự án.</p></div>';
    }
}
