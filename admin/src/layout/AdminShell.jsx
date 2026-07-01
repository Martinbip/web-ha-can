import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

const NAV_ITEMS = [
  ['/', 'Dashboard'],
  ['/resources/news', 'Tin tức'],
  ['/resources/products', 'Sản phẩm'],
  ['/resources/projects', 'Dự án'],
  ['/resources/services', 'Dịch vụ'],
  ['/home', 'Trang chủ'],
  ['/pricing', 'Bảng giá'],
  ['/resources/contact-inquiries', 'Liên hệ'],
  ['/resources/order-requests', 'Đơn đặt mẫu'],
  ['/media', 'Thư viện ảnh'],
  ['/settings', 'Cài đặt website'],
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">Hà Cần</div>
        <nav>
          {NAV_ITEMS.map(([href, label]) => (
            <Link key={href} to={href}>{label}</Link>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <input aria-label="Tìm kiếm" />
          <a href="/" target="_blank" rel="noreferrer">Xem website</a>
          <span>{user?.email}</span>
          <button type="button" onClick={logout}>Đăng xuất</button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
