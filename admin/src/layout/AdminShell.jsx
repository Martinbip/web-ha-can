import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import Icon from '../components/Icon.jsx';
import { setLabelOverrides } from '../config/resources.js';
import { getSingletonResource } from '../api/resources.js';
import TourButton from '../tour/TourButton.jsx';

// Menu được chia nhóm theo công việc thực tế của người quản trị: viết nội dung,
// chỉnh các trang có sẵn, xử lý yêu cầu khách gửi về, và cấu hình website.
const NAV_GROUPS = [
  {
    title: '',
    items: [['/', 'Dashboard', 'dashboard', true]],
  },
  {
    key: 'content',
    title: 'Nội dung',
    items: [
      ['/resources/news', 'Tin tức', 'news'],
      ['/resources/products', 'Sản phẩm', 'product'],
      ['/resources/product-categories', 'Danh mục sản phẩm', 'menu'],
      ['/resources/projects', 'Dự án', 'project'],
      ['/resources/services', 'Dịch vụ', 'service'],
    ],
  },
  {
    key: 'pages',
    title: 'Trang trên website',
    items: [
      ['/home', 'Trang chủ', 'home'],
      ['/pricing', 'Bảng giá', 'price'],
      ['/menu', 'Thanh menu', 'menu'],
    ],
  },
  {
    key: 'inbox',
    title: 'Khách gửi về',
    items: [
      ['/resources/contact-inquiries', 'Liên hệ', 'inbox'],
      ['/resources/order-requests', 'Đơn đặt mẫu', 'order'],
    ],
  },
  {
    key: 'system',
    title: 'Hệ thống',
    items: [
      ['/media', 'Thư viện ảnh', 'media'],
      ['/settings', 'Cài đặt website', 'settings'],
      ['/form-labels', 'Chữ trong form', 'settings'],
    ],
  },
];

const COLLAPSE_KEY = 'dha-admin-sidebar-collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleRef = useRef(null);
  const closeRef = useRef(null);

  // Chữ trong form do quản trị đặt lại nằm cùng bản ghi cài đặt website. Nạp một
  // lần khi vào khu quản trị rồi phủ lên cấu hình gốc; hỏng thì form giữ chữ mặc định.
  const [, setLabelsLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getSingletonResource('site-setting')
      .then((data) => {
        if (cancelled) return;
        setLabelOverrides(data?.admin_labels);
        setLabelsLoaded(true);
      })
      .catch(() => {
        /* không tải được thì dùng chữ mặc định trong cấu hình */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Điều hướng xong thì đóng ngăn kéo, nhưng không giật tiêu điểm về nút mở.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* localStorage bị chặn thì bỏ qua, chỉ mất khả năng ghi nhớ */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={`admin-shell${drawerOpen ? ' drawer-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#admin-main">Bỏ qua menu, đến nội dung</a>

      <aside className="sidebar" aria-label="Điều hướng quản trị" data-tour="sidebar">
        <div className="sidebar-head">
          <span className="brand" title="DHA Hà Cẩn">
            <span className="brand-mark">DHA</span>
            <span className="brand-text">Quản trị website</span>
          </span>
          <button
            type="button"
            className="drawer-close"
            ref={closeRef}
            aria-label="Đóng menu"
            onClick={closeDrawer}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div
              className="nav-group"
              key={group.title || `group-${groupIndex}`}
              data-tour={group.key ? `nav-${group.key}` : undefined}
            >
              {group.title ? <p className="nav-group-title">{group.title}</p> : null}
              {group.items.map(([href, label, icon, exact]) => (
                <NavLink
                  key={href}
                  to={href}
                  end={Boolean(exact)}
                  className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon name={icon} size={19} />
                  <span className="nav-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-pressed={collapsed}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={18} />
          <span className="nav-label">Thu gọn menu</span>
        </button>
      </aside>

      {drawerOpen ? <div className="sidebar-backdrop" onClick={closeDrawer} /> : null}

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            ref={toggleRef}
            aria-label="Mở menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="bars" size={20} />
          </button>

          <div className="topbar-spacer" />

          <TourButton />

          <a className="topbar-link" href="/" target="_blank" rel="noreferrer" data-tour="view-site">
            <Icon name="external" size={17} />
            <span>Xem website</span>
          </a>

          <div className="topbar-user" data-tour="account">
            <span className="avatar" aria-hidden="true">
              {(user?.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="topbar-email" title={user?.email}>{user?.email}</span>
          </div>

          <button type="button" className="topbar-logout" onClick={logout}>
            <Icon name="logout" size={17} />
            <span>Đăng xuất</span>
          </button>
        </header>

        <div id="admin-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
