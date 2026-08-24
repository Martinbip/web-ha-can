import React, { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useTour } from './TourProvider.jsx';
import { OVERVIEW_TOUR_ID, TOURS } from './tourSteps.js';

// Dấu hỏi trên thanh trên cùng: cửa duy nhất để gọi lại hướng dẫn. Liệt kê tour
// của đúng màn hình đang mở trước, tour tổng quan sau.
export default function TourButton() {
  const { pageTourId, hasUnseenPageTour, hasSeen, startTour } = useTour();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function run(id) {
    setOpen(false);
    setNotice('');
    // Lớp phủ phải đợi menu popover biến mất, nếu không nó chỉ vào chỗ sắp mất.
    window.setTimeout(() => {
      if (!startTour(id)) setNotice('Màn hình này chưa có gì để chỉ.');
    }, 0);
  }

  const pageTour = pageTourId && pageTourId !== OVERVIEW_TOUR_ID ? TOURS[pageTourId] : null;

  return (
    <div className="tour-launcher" ref={wrapRef}>
      <button
        type="button"
        className={`topbar-help${hasUnseenPageTour ? ' has-new' : ''}`}
        data-tour="help"
        aria-label="Hướng dẫn sử dụng"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="help" size={18} />
      </button>

      {open ? (
        <div className="tour-menu" role="menu">
          <p className="tour-menu-title">Hướng dẫn sử dụng</p>

          {pageTour ? (
            <button type="button" className="tour-menu-item" role="menuitem" onClick={() => run(pageTourId)}>
              <strong>{pageTour.label}</strong>
              <span>{pageTour.description}</span>
              {!hasSeen(pageTourId) ? <em className="tour-menu-new">Chưa xem</em> : null}
            </button>
          ) : null}

          <button type="button" className="tour-menu-item" role="menuitem" onClick={() => run(OVERVIEW_TOUR_ID)}>
            <strong>{TOURS[OVERVIEW_TOUR_ID].label}</strong>
            <span>{TOURS[OVERVIEW_TOUR_ID].description}</span>
          </button>
        </div>
      ) : null}

      {notice ? <p className="tour-launcher-notice" role="status">{notice}</p> : null}
    </div>
  );
}
