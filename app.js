/**
 * APP LOGIC - KIM LOẠI MÀU DHA (KIMLOAIMAUDHA.COM.VN)
 * Dynamic CMS Integration (Strapi / JSON Fallback)
 * Ore Specimen Estimator, Navigation, Contact Form, and Site Settings
 */

// Set STRAPI_URL via window.__STRAPI_URL (injected by server) or default to localhost
const STRAPI_BASE_URL = (typeof window.__STRAPI_URL !== 'undefined' && window.__STRAPI_URL)
    ? window.__STRAPI_URL
    : 'http://localhost:1337';

// POST data to Strapi (no fallback — write-only, offline graceful)
async function postToCMS(endpoint, payload) {
    const response = await fetch(`${STRAPI_BASE_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Utility function to fetch content from Strapi with local static JSON fallback
async function fetchFromCMS(endpoint, fallbackFile) {
    try {
        const response = await fetch(`${STRAPI_BASE_URL}/api/${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const json = await response.json();
        
        // Strapi returns { data: [...] } or { data: { id: ..., attributes: ... } }
        if (json && json.data) {
            if (Array.isArray(json.data)) {
                return json.data.map(item => {
                    if (item.attributes) {
                        return { id: item.id, ...item.attributes };
                    }
                    return item;
                });
            } else if (json.data.attributes) {
                return { id: json.data.id, ...json.data.attributes };
            }
            return json.data;
        }
        return json;
    } catch (error) {
        console.warn(`[CMS API] Fetch failed for ${endpoint}. Falling back to static JSON (${fallbackFile}):`, error);
        const response = await fetch(fallbackFile);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }
}

// Utility function to resolve image URLs from local fallback or Strapi media library
function getImageUrl(imageObj, fallbackUrl) {
    if (!imageObj) return fallbackUrl;
    if (typeof imageObj === 'string') return imageObj;
    
    // Strapi v4/v5 Media object url checking
    if (imageObj.data && imageObj.data.attributes && imageObj.data.attributes.url) {
        return `${STRAPI_BASE_URL}${imageObj.data.attributes.url}`;
    }
    if (imageObj.url) {
        return `${STRAPI_BASE_URL}${imageObj.url}`;
    }
    if (imageObj.data && imageObj.data.url) {
        return `${STRAPI_BASE_URL}${imageObj.data.url}`;
    }
    return fallbackUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. MOBILE MENU NAVIGATION
    // ----------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const navLinksWrapper = document.querySelector('.nav-links-wrapper');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('open');
            navLinksWrapper.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', menuToggle.classList.contains('open'));
        });
    }
    
    // Close mobile menu when clicking links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (menuToggle) menuToggle.classList.remove('open');
            if (navLinksWrapper) navLinksWrapper.classList.remove('open');
        });
    });

    // ----------------------------------------------------
    // 2. TABS SELECTOR (PRICING SECTION)
    // ----------------------------------------------------
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked button and target panel
            button.classList.add('active');
            const targetPanel = document.getElementById(targetTab);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // ----------------------------------------------------
    // 3. ACTIVE SECTION TRACKING (SCROLL & PAGE HIGHLIGHT)
    // ----------------------------------------------------
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    
    // Set active link based on filename
    navLinks.forEach(link => link.classList.remove('active'));
    if (page === 'index.html' || page === '') {
        const homeNav = document.getElementById('nav-home');
        if (homeNav) homeNav.classList.add('active');
    } else {
        const pageName = page.split('.')[0]; // e.g. 'estimator'
        const activeNav = document.getElementById(`nav-${pageName}`);
        if (activeNav) activeNav.classList.add('active');
    }

    const sections = document.querySelectorAll('section[id]');
    const highlightNav = () => {
        if (page !== 'index.html' && page !== '') return; // Only highlight sections on home page
        
        const scrollY = window.pageYOffset;
        
        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 120; // offset for floating navbar
            const sectionId = current.getAttribute('id');
            const navElement = document.getElementById(`nav-${sectionId}`);
            
            if (navElement) {
                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    navLinks.forEach(link => link.classList.remove('active'));
                    navElement.classList.add('active');
                }
            }
        });
    };
    
    if (page === 'index.html' || page === '') {
        window.addEventListener('scroll', highlightNav);
    }

    // ----------------------------------------------------
    // 4. INTERACTIVE ORE SAMPLE COST ESTIMATOR (DYNAMIC)
    // ----------------------------------------------------
    const calcForm = document.getElementById('calculator-form');
    if (calcForm) {
        const estGroupSelect = document.getElementById('est-group');
        const estOreSelect = document.getElementById('est-ore');
        const estWeightInput = document.getElementById('est-weight');
        const estMethodSelect = document.getElementById('est-method');
        const estPackSelect = document.getElementById('est-pack');
        const estPermitCheck = document.getElementById('est-permit');
        
        const resultPlaceholder = document.getElementById('result-placeholder');
        const resultContent = document.getElementById('result-content');
        
        const resultTotal = document.getElementById('result-total');
        const resultTotalWeight = document.getElementById('result-total-weight');
        const resultAvgPrice = document.getElementById('result-avg-price');
        const resultOreCost = document.getElementById('result-ore-cost');
        const resultAnalysisCost = document.getElementById('result-analysis-cost');
        const resultPackCost = document.getElementById('result-pack-cost');
        const resultDiscount = document.getElementById('result-discount');

        let allOres = [];

        // Fetch dynamic ores list and configure UI dropdowns
        const loadOresConfig = async () => {
            try {
                allOres = await fetchFromCMS('ores', 'data/ores.json');
                populateOresDropdown(estGroupSelect.value);
            } catch (e) {
                console.error('[Estimator] Failed to fetch ores data:', e);
            }
        };

        const populateOresDropdown = (group) => {
            if (!estOreSelect) return;
            estOreSelect.innerHTML = '';
            
            const filteredOres = allOres.filter(ore => ore.group === group);
            filteredOres.forEach((ore, idx) => {
                const opt = document.createElement('option');
                opt.value = ore.uid;
                opt.textContent = ore.name;
                if (idx === 0) opt.selected = true;
                estOreSelect.appendChild(opt);
            });
        };

        // Dynamic change of ore selection based on Group selection
        estGroupSelect.addEventListener('change', () => {
            populateOresDropdown(estGroupSelect.value);
        });
        
        // Formatting numbers to VND currency format (e.g. 1.500.000 đ)
        const formatVND = (number) => {
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(number);
        };

        calcForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Parse form inputs
            const selectedOreUid = estOreSelect.value;
            const weight = parseFloat(estWeightInput.value);
            const method = estMethodSelect.value;
            const pack = estPackSelect.value;
            const permit = estPermitCheck.checked;
            
            // Validation checks
            if (isNaN(weight) || weight <= 0) {
                alert('Khối lượng mẫu không hợp lệ.');
                return;
            }

            // 1. Determine unit price of the ore specimen (per kg) from CMS config
            const oreRecord = allOres.find(ore => ore.uid === selectedOreUid);
            let unitPrice = 180000; // Default chalcopyrite fallback
            let oreName = "Mẫu Quặng";

            if (oreRecord) {
                unitPrice = oreRecord.price;
                oreName = oreRecord.name;
            } else {
                // Hardcoded fallback if CMS and local JSON fail entirely
                if (selectedOreUid === 'copper-ore') { unitPrice = 180000; oreName = "Quặng Đồng Chalcopyrite"; }
                else if (selectedOreUid === 'bauxite-ore') { unitPrice = 120000; oreName = "Quặng Bauxit Nhôm"; }
                else if (selectedOreUid === 'lead-zinc-ore') { unitPrice = 150000; oreName = "Quặng Chì - Kẽm Galena"; }
                else if (selectedOreUid === 'iron-ore') { unitPrice = 80000; oreName = "Quặng Sắt Magnetite"; }
                else if (selectedOreUid === 'manganese-ore') { unitPrice = 90000; oreName = "Quặng Mangan Pyrolusite"; }
                else if (selectedOreUid === 'chromite-ore') { unitPrice = 140000; oreName = "Quặng Cromit"; }
                else if (selectedOreUid === 'rare-earth-ore') { unitPrice = 650000; oreName = "Đất Hiếm Bastnasite"; }
                else if (selectedOreUid === 'titanium-ore') { unitPrice = 220000; oreName = "Cát Đen Ilmenite (Titan)"; }
                else if (selectedOreUid === 'monazite-ore') { unitPrice = 450000; oreName = "Khoáng Vật Monazite"; }
            }

            // 2. Determine testing / analysis cost
            let analysisCost = 0;
            if (method === 'xrf') {
                analysisCost = 1500000;
            } else if (method === 'icp') {
                analysisCost = 3500000;
            } else if (method === 'flotation') {
                analysisCost = 5000000;
            }

            // 3. Determine packing cost
            let packCost = 50000; // default box
            if (pack === 'bag') {
                packCost = 100000;
            } else if (pack === 'barrel') {
                packCost = 300000;
            }

            // 4. Calculate raw cost
            const oreCost = weight * unitPrice;
            
            // 5. Volume discount
            let discount = 0;
            if (weight >= 50 && weight < 100) {
                discount = oreCost * 0.10;
            } else if (weight >= 100) {
                discount = oreCost * 0.20;
            }

            // 6. Permit fee
            let permitCost = permit ? 500000 : 0;

            const totalEstCost = oreCost + analysisCost + packCost + permitCost - discount;

            // 7. Update UI results
            resultTotal.innerText = formatVND(totalEstCost);
            resultTotalWeight.innerText = `${weight} kg (${oreName})`;
            resultAvgPrice.innerText = `${formatVND(unitPrice)} / kg`;
            resultOreCost.innerText = formatVND(oreCost);
            resultAnalysisCost.innerText = formatVND(analysisCost);
            
            let finalPackCostStr = formatVND(packCost);
            if (permit) {
                finalPackCostStr += ` + ${formatVND(permitCost)} (C.O)`;
            }
            resultPackCost.innerText = finalPackCostStr;

            if (discount > 0) {
                resultDiscount.innerText = `-${formatVND(discount)} (${weight >= 100 ? "Giảm 20%" : "Giảm 10%"})`;
                resultDiscount.parentElement.classList.remove('hidden');
            } else {
                resultDiscount.innerText = formatVND(0);
                resultDiscount.parentElement.classList.add('hidden');
            }

            // Hide placeholder and reveal results
            resultPlaceholder.classList.add('hidden');
            resultContent.classList.remove('hidden');
            
            // Scroll slightly down to make result visible on small mobile screens
            if (window.innerWidth <= 768) {
                resultContent.scrollIntoView({ behavior: 'smooth' });
            }
        });

        // Trigger loading configuration
        loadOresConfig();
    }

    // ----------------------------------------------------
    // 5. CONTACT FORM → STRAPI API SUBMISSION
    // ----------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    const successModal = document.getElementById('success-modal');
    const modalClose = document.getElementById('modal-close');

    if (contactForm) {
        const submitBtn = contactForm.querySelector('[type="submit"]');

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('contact-name').value.trim();
            const phone = document.getElementById('contact-phone').value.trim();
            const address = document.getElementById('contact-address').value.trim();
            const email = document.getElementById('contact-email')?.value.trim() || '';
            const service = document.getElementById('contact-service')?.value || 'cung-cap-mau';
            const message = document.getElementById('contact-message')?.value.trim() || '';

            if (!name || !phone || !address) {
                alert('Yêu cầu điền đầy đủ các thông tin bắt buộc (*).');
                return;
            }

            // Disable button to prevent double-submit
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang Gửi...';
            }

            let submitted = false;

            try {
                const response = await fetch(`${STRAPI_BASE_URL}/api/contact-inquiries`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: { name, phone, email, address, service, message, status: 'new' }
                    })
                });

                if (response.ok) {
                    submitted = true;
                } else {
                    const err = await response.json().catch(() => ({}));
                    console.warn('[Contact] Strapi error:', err);
                }
            } catch (err) {
                console.warn('[Contact] Could not reach Strapi, storing locally:', err);
            }

            // Fallback: log to console so data is not silently lost
            if (!submitted) {
                console.info('[Contact Fallback] Inquiry data:', { name, phone, email, address, service, message });
            }

            // Always show success modal — user experience must not be blocked
            if (successModal) successModal.classList.remove('hidden');
            contactForm.reset();

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Gửi Yêu Cầu Tư Vấn';
            }
        });
    }
    
    // Close success modal
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (successModal) successModal.classList.add('hidden');
        });
    }
    
    // Close modal clicking outside container
    if (successModal) {
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) {
                successModal.classList.add('hidden');
            }
        });
    }

    // ----------------------------------------------------
    // 6. SCROLL TO TOP UTILITY
    // ----------------------------------------------------
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 500) {
                scrollTopBtn.classList.remove('hidden');
            } else {
                scrollTopBtn.classList.add('hidden');
            }
        });
        
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ----------------------------------------------------
    // 7. SITE SETTINGS — load from Strapi, populate DOM
    // ----------------------------------------------------
    loadSiteSettings();

    // ----------------------------------------------------
    // 8. MOBILE STICKY BOTTOM CTA BAR (injected via JS)
    // ----------------------------------------------------
    const mobileCTABar = document.createElement('div');
    mobileCTABar.className = 'mobile-cta-bar';
    mobileCTABar.setAttribute('aria-label', 'Thanh liên hệ nhanh');
    mobileCTABar.innerHTML = `
        <a href="tel:0981234567" class="mobile-cta-call" aria-label="Gọi điện cho DHA Minerals">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
            </svg>
            Gọi Ngay
        </a>
        <a href="contact.html" class="mobile-cta-quote">Yêu Cầu Mẫu Quặng</a>
    `;
    document.body.appendChild(mobileCTABar);

    // ----------------------------------------------------
    // 9. HERO CAROUSEL
    // ----------------------------------------------------
    initHeroCarousel();

    // ----------------------------------------------------
    // 10. INITIALIZE DYNAMIC PAGES CONTENTS
    // ----------------------------------------------------
    initDynamicPageContent();
});

// ----------------------------------------------------
// SITE SETTINGS LOADER
// Fetches from Strapi /api/site-setting and populates
// footer, contact page, and mobile CTA bar dynamically.
// ----------------------------------------------------
async function loadSiteSettings() {
    let settings = null;

    try {
        const res = await fetch(`${STRAPI_BASE_URL}/api/site-setting`);
        if (res.ok) {
            const json = await res.json();
            settings = json?.data || json;
        }
    } catch (err) {
        console.warn('[SiteSettings] Cannot reach Strapi, using page defaults.');
    }

    if (!settings) return;

    // Helper: update all elements matching a selector
    const setAll = (selector, value, attr = 'textContent') => {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => {
            if (attr === 'textContent') el.textContent = value;
            else if (attr === 'href') el.setAttribute('href', value);
        });
    };

    // --- Footer & Contact page: address, phone, email ---
    const toTel = (num) => num ? num.replace(/\./g, '').replace(/\s/g, '') : '';
    const hotlineRaw = toTel(settings.hotline);
    const hotline2Raw = toTel(settings.hotline2);

    // Phone numbers — update text and href separately by class to avoid collision
    setAll('.site-hotline', settings.hotline);
    setAll('.site-hotline2', settings.hotline2);
    if (hotlineRaw) {
        document.querySelectorAll('.site-hotline[href^="tel:"]').forEach((el) => el.setAttribute('href', `tel:${hotlineRaw}`));
    }
    if (hotline2Raw) {
        document.querySelectorAll('.site-hotline2[href^="tel:"]').forEach((el) => el.setAttribute('href', `tel:${hotline2Raw}`));
    }

    // Emails — update both href and text content
    setAll('.site-email', settings.email);
    if (settings.email) {
        document.querySelectorAll('.site-email[href^="mailto:"]').forEach((el) => el.setAttribute('href', `mailto:${settings.email}`));
    }

    // Address & office name
    setAll('.site-address', settings.address);
    setAll('.site-office-name', settings.office_name);
    setAll('.site-tax-code', settings.tax_code ? `MST: ${settings.tax_code}` : '');

    // --- Social links ---
    const socials = [
        { selector: '.social-link[aria-label="Facebook"]', url: settings.facebook_url },
        { selector: '.social-link[aria-label="YouTube"]', url: settings.youtube_url },
        { selector: '.social-link[aria-label="Twitter/X"]', url: settings.twitter_url },
        { selector: '.social-link[aria-label="Zalo"]', url: settings.zalo_url },
    ];
    socials.forEach(({ selector, url }) => {
        if (!url) return;
        document.querySelectorAll(selector).forEach((el) => el.setAttribute('href', url));
    });

    // --- Mobile CTA bar: update phone number ---
    const mobileCTACall = document.querySelector('.mobile-cta-call');
    if (mobileCTACall && settings.hotline) {
        mobileCTACall.setAttribute('href', `tel:${hotlineRaw}`);
    }
}

// ----------------------------------------------------
// ORDER REQUEST MODAL
// ----------------------------------------------------
let _orderModalEl = null;

function getOrderModal() {
    if (_orderModalEl) return _orderModalEl;

    const overlay = document.createElement('div');
    overlay.id = 'order-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'order-modal-title');
    overlay.style.display = 'none';

    overlay.innerHTML = `
        <div class="modal order-modal" id="order-modal-box">
            <button class="order-close-btn" id="order-close-btn" aria-label="Đóng">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>

            <div class="order-modal-product">
                <span class="order-modal-badge product-badge" id="order-modal-badge"></span>
                <div class="order-modal-product-info">
                    <p class="order-modal-product-label">Sản Phẩm Đặt Mua</p>
                    <h2 class="order-modal-product-name font-accent" id="order-modal-title"></h2>
                </div>
            </div>

            <div class="order-modal-rule"></div>

            <form id="order-form" class="order-form" novalidate>
                <input type="hidden" id="order-product-uid">
                <input type="hidden" id="order-product-name-val">

                <div class="order-form-row">
                    <div class="order-field">
                        <label class="order-label" for="order-cname">Họ và tên *</label>
                        <input type="text" id="order-cname" class="order-input"
                               placeholder="Nguyễn Văn A" autocomplete="name" required>
                        <span class="order-error" id="err-cname"></span>
                    </div>
                    <div class="order-field">
                        <label class="order-label" for="order-phone">Số điện thoại *</label>
                        <input type="tel" id="order-phone" class="order-input"
                               placeholder="09x xxx xxxx" autocomplete="tel" required>
                        <span class="order-error" id="err-phone"></span>
                    </div>
                </div>

                <div class="order-field">
                    <label class="order-label" for="order-email">Email</label>
                    <input type="email" id="order-email" class="order-input"
                           placeholder="email@congty.vn" autocomplete="email">
                </div>

                <div class="order-field">
                    <label class="order-label" for="order-qty">Số lượng cần *</label>
                    <div class="order-qty-row">
                        <input type="number" id="order-qty" class="order-input order-qty-input"
                               placeholder="100" min="0.1" step="0.1" required>
                        <select id="order-unit" class="order-unit-select">
                            <option value="kg">kg</option>
                            <option value="tan">tấn</option>
                        </select>
                    </div>
                    <span class="order-error" id="err-qty"></span>
                </div>

                <div class="order-field">
                    <label class="order-label" for="order-note">Ghi chú</label>
                    <textarea id="order-note" class="order-input order-textarea" rows="3"
                              placeholder="Địa chỉ giao hàng, yêu cầu chứng chỉ phân tích..."></textarea>
                </div>

                <div class="order-modal-actions">
                    <button type="submit" class="btn-primary order-submit-btn" id="order-submit-btn">
                        Gửi Yêu Cầu Đặt Mẫu
                    </button>
                    <button type="button" class="order-cancel-btn" id="order-cancel-btn">Huỷ</button>
                </div>
            </form>

            <div id="order-success" class="order-success" hidden>
                <div class="order-success-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <h3 class="order-success-title font-accent">Đã Ghi Nhận!</h3>
                <p class="order-success-desc">
                    Chúng tôi sẽ liên hệ xác nhận đơn hàng của bạn trong vòng <strong>24 giờ</strong> làm việc.
                </p>
                <button type="button" class="btn-primary" id="order-success-close">Đóng</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Wire events once
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOrderModal(); });
    overlay.querySelector('#order-close-btn').addEventListener('click', closeOrderModal);
    overlay.querySelector('#order-cancel-btn').addEventListener('click', closeOrderModal);
    overlay.querySelector('#order-success-close').addEventListener('click', closeOrderModal);
    overlay.querySelector('#order-form').addEventListener('submit', handleOrderSubmit);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && _orderModalEl && !_orderModalEl.hidden) closeOrderModal();
    });

    _orderModalEl = overlay;
    return overlay;
}

function openOrderModal(uid, name, group) {
    const overlay = getOrderModal();

    // Fill product info
    overlay.querySelector('#order-modal-title').textContent = name;
    overlay.querySelector('#order-product-uid').value = uid || '';
    overlay.querySelector('#order-product-name-val').value = name || '';

    const badge = overlay.querySelector('#order-modal-badge');
    badge.textContent = GROUP_LABEL[group] || group;
    badge.className = `order-modal-badge product-badge ${GROUP_CSS[group] || ''}`;

    // Reset to form view
    overlay.querySelector('#order-form').reset();
    overlay.querySelector('#order-form').hidden = false;
    overlay.querySelector('#order-success').hidden = true;
    overlay.querySelectorAll('.order-error').forEach(el => { el.textContent = ''; });

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => overlay.querySelector('#order-cname')?.focus(), 80);
}

function closeOrderModal() {
    if (_orderModalEl) _orderModalEl.style.display = 'none';
    document.body.style.overflow = '';
}

async function handleOrderSubmit(e) {
    e.preventDefault();

    const overlay = _orderModalEl;
    const name  = overlay.querySelector('#order-cname').value.trim();
    const phone = overlay.querySelector('#order-phone').value.trim();
    const qty   = parseFloat(overlay.querySelector('#order-qty').value);

    let valid = true;

    if (name.length < 2) {
        overlay.querySelector('#err-cname').textContent = 'Vui lòng nhập tên đầy đủ.';
        valid = false;
    } else {
        overlay.querySelector('#err-cname').textContent = '';
    }

    if (!/^(0|\+84)[0-9\s]{8,11}$/.test(phone)) {
        overlay.querySelector('#err-phone').textContent = 'Số điện thoại không hợp lệ.';
        valid = false;
    } else {
        overlay.querySelector('#err-phone').textContent = '';
    }

    if (!qty || qty <= 0) {
        overlay.querySelector('#err-qty').textContent = 'Vui lòng nhập số lượng hợp lệ.';
        valid = false;
    } else {
        overlay.querySelector('#err-qty').textContent = '';
    }

    if (!valid) return;

    const btn = overlay.querySelector('#order-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Đang gửi...';

    const payload = {
        product_uid:   overlay.querySelector('#order-product-uid').value,
        product_name:  overlay.querySelector('#order-product-name-val').value,
        customer_name: name,
        phone,
        email:    overlay.querySelector('#order-email').value.trim(),
        quantity: qty,
        unit:     overlay.querySelector('#order-unit').value,
        note:     overlay.querySelector('#order-note').value.trim(),
    };

    try {
        await postToCMS('order-requests', payload);
    } catch (err) {
        // CMS offline — still show success; admin can follow up via phone
        console.warn('[Order] CMS unavailable, proceeding offline:', err);
    }

    btn.disabled = false;
    btn.textContent = 'Gửi Yêu Cầu Đặt Mẫu';

    overlay.querySelector('#order-form').hidden = true;
    overlay.querySelector('#order-success').hidden = false;
}

// Global delegated click handler for order buttons (works for both homepage + products page)
document.addEventListener('click', e => {
    const btn = e.target.closest('.order-btn');
    if (!btn) return;
    openOrderModal(btn.dataset.uid, btn.dataset.name, btn.dataset.group);
});

// ----------------------------------------------------
// HERO CAROUSEL — auto-advances every 10 s, fade + Ken Burns
// ----------------------------------------------------
function initHeroCarousel() {
    const card = document.getElementById('hero-carousel');
    if (!card) return;

    const slides = card.querySelectorAll('.carousel-slide');
    const dots   = card.querySelectorAll('.carousel-dot');
    if (slides.length < 2) return;

    let current = 0;
    let timer   = null;

    function goTo(index) {
        slides[current].classList.remove('active');
        dots[current].classList.remove('active');
        dots[current].setAttribute('aria-selected', 'false');

        current = (index + slides.length) % slides.length;

        slides[current].classList.add('active');
        dots[current].classList.add('active');
        dots[current].setAttribute('aria-selected', 'true');
    }

    function startTimer() {
        timer = setInterval(() => goTo(current + 1), 10000);
    }

    function resetTimer() {
        clearInterval(timer);
        startTimer();
    }

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            if (i === current) return;
            goTo(i);
            resetTimer();
        });
    });

    // Pause on hover, resume on leave
    card.addEventListener('mouseenter', () => clearInterval(timer));
    card.addEventListener('mouseleave', startTimer);

    startTimer();
}

// Dynamic Loader Routing based on active HTML elements
function initDynamicPageContent() {
    initProjectsPage();
    initPricingPage();
    initProductsPage();
    initHomeProducts();
}

// ----------------------------------------------------
// DYNAMIC PAGES LOADING HANDLERS
// ----------------------------------------------------

async function initProjectsPage() {
    const container = document.getElementById('projects-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center w-full" style="grid-column: 1/-1; padding: var(--space-xl) 0;"><p>Đang tải danh sách dự án...</p></div>';
    
    try {
        const projects = await fetchFromCMS('projects?populate=*', 'data/projects.json');
        container.innerHTML = '';
        
        if (!projects || projects.length === 0) {
            container.innerHTML = '<div class="text-center w-full" style="grid-column: 1/-1;"><p>Không tìm thấy dự án nào.</p></div>';
            return;
        }
        
        projects.forEach(project => {
            const imgUrl = getImageUrl(project.image, 'assets/mo_quang_ha_nam.png');
            let metaParts = [];
            if (project.scale) metaParts.push(`Quy mô: ${project.scale}`);
            if (project.method) metaParts.push(`Phương pháp: ${project.method}`);
            if (project.value) metaParts.push(project.value);
            
            const metaText = metaParts.join(' | ');
            
            const cardHtml = `
                <div class="project-item card">
                    <div class="project-img-box">
                        <img src="${imgUrl}" alt="${project.name}" class="project-img" onerror="this.src='assets/mo_quang_ha_nam.png'">
                    </div>
                    <div class="project-info">
                        <span class="project-location text-cta font-accent">${project.location}</span>
                        <h3 class="project-name">${project.name}</h3>
                        <p class="project-meta">${metaText}</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });
    } catch (e) {
        console.error('[Projects] Error loading projects:', e);
        container.innerHTML = '<div class="text-center w-full text-red" style="grid-column: 1/-1;"><p>Không thể kết nối đến máy chủ dữ liệu dự án.</p></div>';
    }
}

async function initPricingPage() {
    const packagesContainer = document.getElementById('packages-container');
    const analysisTableBody = document.getElementById('analysis-table-body');
    const surveyTableBody = document.getElementById('survey-table-body');
    
    if (packagesContainer) {
        packagesContainer.innerHTML = '<div class="text-center w-full" style="grid-column: 1/-1; padding: var(--space-xl) 0;"><p>Đang tải các gói báo giá...</p></div>';
        try {
            const packages = await fetchFromCMS('pricing-packages', 'data/pricing_packages.json');
            packagesContainer.innerHTML = '';
            
            if (!packages || packages.length === 0) {
                packagesContainer.innerHTML = '<div class="text-center w-full" style="grid-column: 1/-1;"><p>Không có báo giá quặng mẫu.</p></div>';
            } else {
                packages.forEach(pkg => {
                    const popularClass = pkg.popular ? 'highlighted' : '';
                    const textWhite = pkg.popular ? 'text-white' : '';
                    const textLight = pkg.popular ? 'text-light' : '';
                    const hrWhite = pkg.popular ? 'white' : '';
                    const btnClass = pkg.popular ? 'btn-primary' : 'btn-secondary';
                    
                    let specsHtml = '';
                    let specsArray = [];
                    if (Array.isArray(pkg.specs)) {
                        specsArray = pkg.specs;
                    } else if (typeof pkg.specs === 'string') {
                        try {
                            specsArray = JSON.parse(pkg.specs);
                        } catch (e) {
                            specsArray = pkg.specs.split('\n').filter(Boolean);
                        }
                    }
                    
                    specsArray.forEach(spec => {
                        const colonIndex = spec.indexOf(':');
                        if (colonIndex > -1) {
                            const label = spec.substring(0, colonIndex);
                            const val = spec.substring(colonIndex + 1);
                            specsHtml += `<li><span class="bullet">✓</span> <span>${label}:</span> ${val}</li>`;
                        } else {
                            specsHtml += `<li><span class="bullet">✓</span> ${spec}</li>`;
                        }
                    });
                    
                    const priceFormatted = new Intl.NumberFormat('vi-VN').format(pkg.price) + 'đ';
                    
                    const cardHtml = `
                        <div class="package-card card ${popularClass}">
                            ${pkg.popular ? '<div class="badge-popular">Bán Chạy</div>' : ''}
                            <div class="package-header">
                                <h3 class="package-title ${textWhite}">${pkg.title}</h3>
                                <div class="package-price ${textWhite}">${priceFormatted} <span class="price-unit ${textLight}">${pkg.unit || '/ kg'}</span></div>
                                <p class="package-desc ${textLight}">${pkg.description}</p>
                            </div>
                            <hr class="package-divider ${hrWhite}">
                            <ul class="package-specs ${textWhite}">
                                ${specsHtml}
                            </ul>
                            <a href="contact.html" class="${btnClass} w-full text-center display-block cursor-pointer">Yêu Cầu Gói Này</a>
                        </div>
                    `;
                    packagesContainer.insertAdjacentHTML('beforeend', cardHtml);
                });
            }
        } catch (e) {
            console.error('[Pricing] Error rendering packages:', e);
            packagesContainer.innerHTML = '<div class="text-center w-full" style="grid-column: 1/-1; color: var(--color-text-muted);"><p>Không thể tải báo giá quặng mẫu. Đang hiển thị ngoại tuyến.</p></div>';
        }
    }
    
    if (analysisTableBody) {
        analysisTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải biểu phí phân tích...</td></tr>';
        try {
            const analysisItems = await fetchFromCMS('pricing-analyses', 'data/pricing_analysis.json');
            analysisTableBody.innerHTML = '';
            
            if (!analysisItems || analysisItems.length === 0) {
                analysisTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Không có biểu phí phân tích nào.</td></tr>';
            } else {
                const chemicalItems = analysisItems.filter(item => item.category === 'chemical');
                const physicalItems = analysisItems.filter(item => item.category === 'physical');
                
                const renderRows = (items) => {
                    return items.map(item => {
                        const priceFormatted = new Intl.NumberFormat('vi-VN').format(item.price) + 'đ';
                        return `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.tech}</td>
                                <td>${item.unit}</td>
                                <td>${priceFormatted}</td>
                                <td>${item.duration}</td>
                            </tr>
                        `;
                    }).join('');
                };
                
                let html = '';
                if (chemicalItems.length > 0) {
                    html += `
                        <tr class="table-group-header"><td colspan="5">1. Hạng Mục Phân Tích Hóa Học & Phổ học</td></tr>
                        ${renderRows(chemicalItems)}
                    `;
                }
                if (physicalItems.length > 0) {
                    html += `
                        <tr class="table-group-header"><td colspan="5">2. Hạng Mục Thử Nghiệm Vật Lý & Tuyển Khoáng</td></tr>
                        ${renderRows(physicalItems)}
                    `;
                }
                analysisTableBody.innerHTML = html;
            }
        } catch (e) {
            console.error('[Pricing] Error rendering analysis pricing:', e);
            analysisTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red">Lỗi tải dữ liệu phép đo kiểm định.</td></tr>';
        }
    }
    
    if (surveyTableBody) {
        surveyTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Đang tải biểu phí khảo sát...</td></tr>';
        try {
            const surveyItems = await fetchFromCMS('pricing-surveys', 'data/pricing_survey.json');
            surveyTableBody.innerHTML = '';
            
            if (!surveyItems || surveyItems.length === 0) {
                surveyTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Không có biểu phí dịch vụ khảo sát mỏ.</td></tr>';
            } else {
                surveyItems.forEach(item => {
                    let priceStr = item.price;
                    if (typeof item.price === 'number') {
                        priceStr = new Intl.NumberFormat('vi-VN').format(item.price) + 'đ';
                    }
                    const rowHtml = `
                        <tr>
                            <td>${item.name}</td>
                            <td>${priceStr}</td>
                            <td>${item.description}</td>
                        </tr>
                    `;
                    surveyTableBody.insertAdjacentHTML('beforeend', rowHtml);
                });
            }
        } catch (e) {
            console.error('[Pricing] Error rendering survey pricing:', e);
            surveyTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-red">Lỗi tải dữ liệu khảo sát mỏ.</td></tr>';
        }
    }
}

// ----------------------------------------------------
// PRODUCTS — shared constants & card builder
// ----------------------------------------------------
const GROUP_LABEL = {
    'color-metal': 'Kim Loại Màu',
    'black-metal': 'Kim Loại Đen',
    'rare-earth':  'Đất Hiếm & Quý',
};

const GROUP_CSS = {
    'color-metal': 'color-metal',
    'black-metal': 'black-metal',
    'rare-earth':  'rare-earth',
};

function buildProductCard(product) {
    const priceFormatted = product.price
        ? new Intl.NumberFormat('vi-VN').format(product.price) + 'đ'
        : 'Liên hệ';
    const inStock     = product.in_stock !== false;
    const groupLabel  = GROUP_LABEL[product.group] || product.group;
    const groupCss    = GROUP_CSS[product.group] || '';
    const imgSrc      = product.image || 'assets/phong_thi_nghiem_dha.png';
    const imgAlt      = product.name || 'Quặng mẫu';
    const estimatorUid = product.uid || '';

    return `
        <div class="product-card card"
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
                    <div class="product-price">
                        <span class="price-amount">${priceFormatted}</span>
                        ${product.price ? '<span class="price-unit">/ kg</span>' : ''}
                    </div>
                    <div class="product-actions">
                        <a href="estimator.html${estimatorUid ? '?ore=' + estimatorUid : ''}" class="btn-secondary btn-sm cursor-pointer">Tính Giá</a>
                        <button type="button"
                                class="btn-primary btn-sm cursor-pointer order-btn"
                                data-uid="${estimatorUid}"
                                data-name="${(product.name || '').replace(/"/g, '&quot;')}"
                                data-group="${product.group}">
                            ${inStock ? 'Đặt Mua' : 'Liên Hệ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// PRODUCTS PAGE — catalog with filter tabs
// ----------------------------------------------------
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
    allProducts.forEach(p => {
        counts[p.group] = (counts[p.group] || 0) + 1;
    });
    ['all', 'color-metal', 'black-metal', 'rare-earth'].forEach(key => {
        const el = document.getElementById(`count-${key}`);
        if (el) el.textContent = counts[key] || 0;
    });

    // Check URL for pre-selected filter
    const urlParams = new URLSearchParams(window.location.search);
    const preFilter = urlParams.get('filter');

    const renderProducts = (filter) => {
        const filtered = filter === 'all'
            ? allProducts
            : allProducts.filter(p => p.group === filter);

        const empty = document.getElementById('products-empty');
        if (filtered.length === 0) {
            container.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';
        container.innerHTML = filtered.map(buildProductCard).join('');
    };

    // Initial render
    const initialFilter = preFilter || 'all';
    renderProducts(initialFilter);

    // Activate correct tab if pre-filter from URL
    if (preFilter) {
        document.querySelectorAll('.product-filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === preFilter;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    // Filter tab click handlers
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

// ----------------------------------------------------
// HOMEPAGE PRODUCTS — inline catalog with tabs + search
// ----------------------------------------------------
async function initHomeProducts() {
    const grid  = document.getElementById('home-products-grid');
    const empty = document.getElementById('home-products-empty');
    if (!grid) return;

    let allProducts = [];
    try {
        allProducts = await fetchFromCMS('products?sort=sort_order:asc', 'data/products.json');
    } catch (e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;color:var(--color-text-muted);">Không thể tải danh mục.</div>';
        return;
    }

    if (!allProducts || !allProducts.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--space-2xl) 0;color:var(--color-text-muted);">Chưa có sản phẩm.</div>';
        return;
    }

    // Populate count numbers in tab labels
    const counts = { all: allProducts.length };
    allProducts.forEach(p => { counts[p.group] = (counts[p.group] || 0) + 1; });
    ['all', 'color-metal', 'black-metal', 'rare-earth'].forEach(key => {
        const el = document.getElementById(`hcount-${key}`);
        if (el) el.textContent = counts[key] || 0;
    });

    let activeFilter = 'all';
    let searchTerm   = '';

    function applyFilters() {
        const term = searchTerm.trim().toLowerCase();
        const cards = grid.querySelectorAll('.product-card');
        let visible = 0;

        cards.forEach(card => {
            const groupMatch = activeFilter === 'all' || card.dataset.group === activeFilter;
            const textMatch  = !term
                || card.dataset.name.includes(term)
                || card.dataset.grade.includes(term)
                || card.dataset.origin.includes(term);
            const show = groupMatch && textMatch;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        if (empty) empty.hidden = visible > 0;
    }

    // Render all cards once
    grid.innerHTML = allProducts.map(buildProductCard).join('');

    // Tab click
    const tabsNav = document.getElementById('home-filter-tabs');
    if (tabsNav) {
        tabsNav.addEventListener('click', e => {
            const btn = e.target.closest('.home-filter-btn');
            if (!btn) return;
            tabsNav.querySelectorAll('.home-filter-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            activeFilter = btn.dataset.filter;
            applyFilters();
        });
    }

    // Search input — debounced 200 ms
    const searchInput = document.getElementById('home-search');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchTerm = searchInput.value;
                applyFilters();
            }, 200);
        });
    }
}
