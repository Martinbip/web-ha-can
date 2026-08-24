import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TourOverlay from './TourOverlay.jsx';
import { OVERVIEW_TOUR_ID, TOURS, tourIdForPath } from './tourSteps.js';
import { resolveSteps } from './tourPlacement.js';

// Bộ nhớ "đã xem tour nào" nằm ở trình duyệt của từng người, không lưu về máy
// chủ: hướng dẫn là chuyện của người ngồi trước màn hình, không phải của tài khoản.
const SEEN_KEY = 'dha-admin-tour-seen';

// Giao diện vừa vẽ xong thì các mốc chưa chắc đã có mặt trong DOM (trang còn
// đang tải dữ liệu). Chờ một nhịp rồi mới đo.
const AUTOSTART_DELAY = 700;

const TourContext = createContext(null);

function readSeen() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeSeen(list) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* localStorage bị chặn thì tour vẫn chạy được, chỉ mất khả năng ghi nhớ */
  }
}

export function TourProvider({ children }) {
  const location = useLocation();
  const [seen, setSeen] = useState(readSeen);
  const [active, setActive] = useState(null); // { id, steps, index }

  const pageTourId = tourIdForPath(location.pathname);

  const stop = useCallback(() => {
    setActive((current) => {
      // Đóng giữa chừng cũng tính là đã xem: người dùng đã chủ động tắt, nhắc
      // lại lần sau chỉ thêm phiền. Muốn xem lại thì có nút dấu hỏi.
      if (current) {
        setSeen((list) => {
          if (list.includes(current.id)) return list;
          const next = [...list, current.id];
          writeSeen(next);
          return next;
        });
      }
      return null;
    });
  }, []);

  const startTour = useCallback((id) => {
    const tour = TOURS[id];
    if (!tour) return false;
    const steps = resolveSteps(tour.steps, document);
    if (steps.length === 0) return false;
    setActive({ id, steps, index: 0 });
    return true;
  }, []);

  const next = useCallback(() => {
    setActive((current) => {
      if (!current) return current;
      if (current.index >= current.steps.length - 1) return current;
      return { ...current, index: current.index + 1 };
    });
  }, []);

  const prev = useCallback(() => {
    setActive((current) => {
      if (!current || current.index === 0) return current;
      return { ...current, index: current.index - 1 };
    });
  }, []);

  // Lần đầu vào khu quản trị thì dẫn đi một vòng. Chỉ tour tổng quan mới tự chạy;
  // tour từng màn hình đợi người dùng bấm dấu hỏi, tránh việc cứ mở trang mới là
  // bị chặn bởi một lớp phủ.
  useEffect(() => {
    if (seen.includes(OVERVIEW_TOUR_ID)) return undefined;
    const timer = window.setTimeout(() => startTour(OVERVIEW_TOUR_ID), AUTOSTART_DELAY);
    return () => window.clearTimeout(timer);
    // Chỉ chạy một lần lúc vào; `seen` đổi về sau là do chính tour này kết thúc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chuyển trang giữa lúc đang chạy tour thì các mốc cũ biến mất — dừng lại.
  useEffect(() => {
    setActive((current) => (current ? null : current));
  }, [location.pathname]);

  const value = useMemo(() => ({
    active,
    pageTourId,
    hasSeen: (id) => seen.includes(id),
    hasUnseenPageTour: Boolean(pageTourId) && !seen.includes(pageTourId),
    startTour,
    stop,
    next,
    prev,
  }), [active, pageTourId, seen, startTour, stop, next, prev]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? (
        <TourOverlay
          step={active.steps[active.index]}
          index={active.index}
          total={active.steps.length}
          onNext={next}
          onPrev={prev}
          onClose={stop}
        />
      ) : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour phải nằm trong TourProvider');
  return value;
}
