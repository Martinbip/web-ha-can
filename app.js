/**
 * ======================================================
 *  DHA Minerals — Kim Loại Màu
 *  Main Application Logic (Refactored)
 * ======================================================
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
});

// ======================================================
// NAVBAR
// ======================================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('menu-toggle');
    const wrapper = document.querySelector('.nav-links-wrapper');

    // Scroll shrink
    if (navbar) {
        window.addEventListener('scroll', () => {
            const navbarWrapper = navbar.closest('.navbar-wrapper');
            if (navbarWrapper) {
                navbarWrapper.classList.toggle('scrolled', window.scrollY > 50);
            }
        }, { passive: true });
    }

    // Mobile menu toggle
    if (toggle && wrapper) {
        // Prepend MENU header to sidebar dynamically if not already present
        if (!wrapper.querySelector('.sidebar-header')) {
            const header = document.createElement('div');
            header.className = 'sidebar-header';
            header.textContent = 'MENU';
            wrapper.insertBefore(header, wrapper.firstChild);
        }

        // Create and append backdrop dynamically
        let backdrop = document.querySelector('.menu-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'menu-backdrop';
            document.body.appendChild(backdrop);
        }

        // Set initial ARIA accessibility attributes dynamically
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

        // Close on backdrop click (click outside sidebar)
        backdrop.addEventListener('click', closeMenu);

        // Close on nav-link click
        wrapper.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // Close on Escape key press (best practice)
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
        timer = setInterval(() => goTo(current + 1), 5000);
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goTo(parseInt(dot.dataset.dot, 10));
            startTimer();
        });
    });

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
    initPricingPage();
    initNewsPage();
    initProjectsPage();
}

// ======================================================
// MARKET PRICES TABLE (Homepage + Pricing Page)
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
                    <td><strong>${item.metal}</strong></td>
                    <td>${item.lme_price}</td>
                    <td>${item.domestic_price}${item.unit}</td>
                    <td class="${trendClass}">${trendIcon} ${item.change}</td>
            `;
            if (showDate) row += `<td>${item.updated}</td>`;
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
// HOME — NEWS PREVIEW (3 bài)
// ======================================================
async function initHomeNewsPreview() {
    const grid = document.getElementById('home-news-grid');
    if (!grid) return;

    try {
        const news = await fetchFromCMS('news', 'data/news.json');
        if (!news || news.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;color:var(--color-text-muted);">Chưa có tin tức nào.</div>';
            return;
        }

        const preview = news.slice(0, 3);
        grid.innerHTML = preview.map(item => buildNewsCard(item)).join('');
    } catch (e) {
        console.error('[News Preview]', e);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--color-text-muted);">Không thể tải tin tức.</div>';
    }
}

// ======================================================
// HOME — PRODUCTS (Lọc và Hiển Thị)
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

    // Phân loại nhóm sản phẩm của trang chủ
    const isColorMetal = (p) => ['dong', 'nhom', 'chi', 'thiec'].includes(p.group) || p.uid === 'quang-dong-tho';
    const isBlackMetal = (p) => p.group === 'quang' && (p.uid.includes('sat') || p.name.toLowerCase().includes('sắt'));
    const isRareEarth  = (p) => p.group === 'rare-earth' || p.uid.includes('dat-hiem') || p.name.toLowerCase().includes('đất hiếm');

    // Đếm số lượng sản phẩm cho mỗi tag lọc
    const counts = {
        all: allProducts.length,
        'color-metal': allProducts.filter(isColorMetal).length,
        'black-metal': allProducts.filter(isBlackMetal).length,
        'rare-earth': allProducts.filter(isRareEarth).length
    };

    // Cập nhật số lượng hiển thị trên các nút tag
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

    // Sự kiện click tag lọc sản phẩm
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

    // Sự kiện nhập ô tìm kiếm sản phẩm nhanh
    const searchInput = document.getElementById('home-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            render(activeFilter, searchInput.value.trim());
        });
    }
}

// ======================================================
// NEWS PAGE — Full Grid
// ======================================================
async function initNewsPage() {
    const grid = document.getElementById('news-full-grid');
    if (!grid) return;

    try {
        const news = await fetchFromCMS('news', 'data/news.json');
        if (!news || news.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;">Chưa có tin tức nào.</div>';
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
    const catLabel = categoryLabels[item.category] || item.category || '';
    const dateStr = item.date ? new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    
    return `
        <article class="news-card card ${fullWidth ? 'news-card-full' : ''}">
            <div class="news-card-img-box">
                <img src="${item.image || 'assets/mo_quang_ha_nam.png'}" alt="${item.title}" class="news-card-img" loading="lazy">
                ${catLabel ? `<span class="news-card-badge">${catLabel}</span>` : ''}
            </div>
            <div class="news-card-body">
                <span class="news-card-date">${dateStr}</span>
                <h3 class="news-card-title">${item.title}</h3>
                <p class="news-card-summary">${item.summary}</p>
            </div>
        </article>
    `;
}

// ======================================================
// PRODUCT CARD BUILDER
// ======================================================
function buildProductCard(product) {
    const inStock     = product.in_stock !== false;
    const groupLabel  = GROUP_LABEL[product.group] || product.group;
    const groupCss    = GROUP_CSS[product.group] || '';
    const imgSrc      = product.image || 'assets/phong_thi_nghiem_dha.png';
    const imgAlt      = product.name || 'Sản phẩm';

    return `
        <a href="product-detail.html?id=${product.uid}" class="product-card card" 
             data-group="${product.group}"
             data-featured="${product.featured ? 'true' : 'false'}"
             data-stock="${inStock ? 'in' : 'out'}"
             data-name="${(product.name || '').toLowerCase()}"
             data-grade="${(product.grade || '').toLowerCase()}"
             data-origin="${(product.origin || '').toLowerCase()}">
            <div class="product-img-wrap">
                <img src="${imgSrc}" alt="${imgAlt}" class="product-img" loading="lazy">
                <span class="product-badge ${groupCss}">${groupLabel}</span>
                <span class="product-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">${inStock ? 'Còn Hàng' : 'Hết Hàng'}</span>
            </div>
            <div class="product-body">
                <h3 class="product-name">${product.name}</h3>
                ${product.grade ? `
                <div class="product-grade">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                    ${product.grade}
                </div>` : ''}
                ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
                ${product.origin ? `
                <div class="product-origin">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    ${product.origin}
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
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;color:var(--color-text-muted);"><p>Không thể tải danh mục sản phẩm.</p></div>';
        return;
    }

    if (!allProducts || allProducts.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;color:var(--color-text-muted);"><p>Chưa có sản phẩm nào.</p></div>';
        return;
    }

    // Update filter counts
    const counts = { all: allProducts.length };
    allProducts.forEach(p => { counts[p.group] = (counts[p.group] || 0) + 1; });
    ['all', 'dong', 'nhom', 'chi', 'thiec', 'quang'].forEach(key => {
        const el = document.getElementById(`count-${key}`);
        if (el) el.textContent = counts[key] || 0;
    });

    // Check URL for pre-selected filter
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

    // Activate correct tab
    if (preFilter) {
        let matched = false;
        document.querySelectorAll('.product-filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === preFilter;
            if (isActive) matched = true;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        if (!matched) {
            // Nếu filter từ URL là nhóm chung (color-metal, black-metal, v.v.), giữ tab "Tất Cả" sáng
            const allBtn = document.querySelector('.product-filter-btn[data-filter="all"]');
            if (allBtn) {
                allBtn.classList.add('active');
                allBtn.setAttribute('aria-selected', 'true');
            }
        }
    }

    // Filter tab click
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
        contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;"><p>Không tìm thấy sản phẩm. <a href="products.html">Quay lại danh mục</a>.</p></div>';
        return;
    }

    try {
        const products = await fetchFromCMS('products', 'data/products.json');
        const product = products.find(p => p.uid === productId);

        if (!product) {
            contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;"><p>Không tìm thấy sản phẩm. <a href="products.html">Quay lại danh mục</a>.</p></div>';
            return;
        }

        // Update page title and breadcrumb
        document.title = `${product.name} - DHA Minerals`;
        const breadcrumb = document.getElementById('detail-breadcrumb');
        if (breadcrumb) breadcrumb.textContent = product.name;

        const groupLabel = GROUP_LABEL[product.group] || product.group;
        const groupCss   = GROUP_CSS[product.group] || '';
        const imgSrc = product.image || 'assets/phong_thi_nghiem_dha.png';
        const inStock = product.in_stock !== false;

        let specsHtml = '';
        if (Array.isArray(product.specs)) {
            specsHtml = product.specs.map(spec => {
                const colonIdx = spec.indexOf(':');
                if (colonIdx > -1) {
                    return `<li><strong>${spec.substring(0, colonIdx)}:</strong> ${spec.substring(colonIdx + 1).trim()}</li>`;
                }
                return `<li>${spec}</li>`;
            }).join('');
        }

        contentEl.innerHTML = `
            <div class="detail-image-box">
                <img src="${imgSrc}" alt="${product.name}" class="detail-img">
                <span class="product-badge ${groupCss}" style="position:absolute;top:var(--space-md);left:var(--space-md);">${groupLabel}</span>
                <span class="product-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}" style="position:absolute;top:var(--space-md);right:var(--space-md);">${inStock ? 'Còn Hàng' : 'Hết Hàng'}</span>
            </div>
            <div class="detail-info">
                <h1 class="detail-title">${product.name}</h1>
                ${product.grade ? `<div class="detail-grade"><strong>Hàm lượng:</strong> ${product.grade}</div>` : ''}
                ${product.origin ? `<div class="detail-origin"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> ${product.origin}</div>` : ''}
                <p class="detail-desc">${product.description || ''}</p>
                ${specsHtml ? `
                <div class="detail-specs">
                    <h3 class="detail-specs-title">Thông Số Kỹ Thuật</h3>
                    <ul class="detail-specs-list">${specsHtml}</ul>
                </div>` : ''}
                <div class="detail-cta-box">
                    <a href="tel:0981234567" class="btn-primary" style="flex:1;text-align:center;">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:18px;height:18px;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        Liên Hệ Nhận Báo Giá
                    </a>
                    <a href="products.html?filter=${product.group}" class="btn-secondary" style="flex:1;text-align:center;">← Quay Lại Danh Mục</a>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('[Product Detail]', e);
        contentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;"><p>Lỗi tải thông tin sản phẩm.</p></div>';
    }
}

// ======================================================
// PRICING PAGE
// ======================================================
async function initPricingPage() {
    // Reuses initMarketPrices for the pricing-table-body
    // Already handled in initMarketPrices()
}

// ======================================================
// CONTACT FORM
// ======================================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name    = document.getElementById('contact-name')?.value?.trim();
        const phone   = document.getElementById('contact-phone')?.value?.trim();
        const message = document.getElementById('contact-message')?.value?.trim();

        if (!name || !phone) {
            alert('Vui lòng nhập đầy đủ Họ tên và Số điện thoại.');
            return;
        }

        // In production, this would POST to CMS or API
        console.log('[Contact] Submitted:', { name, phone, message });

        // Show success modal
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
    });
}

// ======================================================
// PROJECTS PAGE (Dynamic Data)
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
                    <img src="${item.image || 'assets/mo_quang_ha_nam.png'}" alt="${item.name}" class="portfolio-img" loading="lazy">
                </div>
                <div class="portfolio-body">
                    <h3 class="portfolio-name">${item.name}</h3>
                    <div class="portfolio-meta"><strong>Địa điểm:</strong> ${item.location}</div>
                    <div class="portfolio-meta"><strong>Quy mô:</strong> ${item.scale}</div>
                    <div class="portfolio-meta"><strong>Phương pháp:</strong> ${item.method}</div>
                    ${item.value ? `<div class="portfolio-meta"><strong>Kết quả:</strong> ${item.value}</div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('[Projects] Error:', e);
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#666666;"><p>Không thể tải danh mục dự án.</p></div>';
    }
}
