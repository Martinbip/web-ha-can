import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { centeredTooltip, isOnScreen, placeTooltip } from './tourPlacement.js';

function measure(target) {
  const element = document.querySelector(target);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export default function TourOverlay({ step, index, total, onNext, onPrev, onClose }) {
  const [rect, setRect] = useState(() => measure(step.target));
  const cardRef = useRef(null);
  const isLast = index === total - 1;

  const sync = useCallback(() => setRect(measure(step.target)), [step.target]);

  // Mốc có thể đang nằm ngoài tầm nhìn: kéo nó vào giữa màn hình rồi mới đo. Đo
  // hai lần vì cuộn mượt chưa dừng ngay lúc gọi.
  useLayoutEffect(() => {
    const element = document.querySelector(step.target);
    element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    sync();
    const timer = window.setTimeout(sync, 400);
    return () => window.clearTimeout(timer);
  }, [step.target, sync]);

  useEffect(() => {
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [sync]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (isLast) onClose(); else onNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev();
        return;
      }
      // Giữ tiêu điểm quẩn trong bong bóng: phía sau đang bị lớp phủ chặn, tab ra
      // ngoài thì người dùng bàn phím lạc mất chỗ đang đọc.
      if (event.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll('button');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isLast, onNext, onPrev, onClose]);

  const visible = isOnScreen(rect, viewport());
  const tooltip = visible ? placeTooltip(rect, step.placement, viewport()) : centeredTooltip(viewport());

  return (
    <div className="tour" role="presentation">
      <div className="tour-backdrop" onClick={onClose} />

      {visible ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : null}

      <div
        className="tour-card"
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={{ width: tooltip.width, top: tooltip.top, left: tooltip.left, transform: tooltip.transform }}
      >
        <div className="tour-card-head">
          <h2 id="tour-title">{step.title}</h2>
          <button type="button" className="tour-close" onClick={onClose} aria-label="Đóng hướng dẫn">
            <Icon name="close" size={16} />
          </button>
        </div>

        <p className="tour-body">{step.body}</p>

        <div className="tour-foot">
          <span className="tour-progress">Bước {index + 1} / {total}</span>
          <div className="tour-actions">
            {index > 0 ? (
              <button type="button" className="btn-secondary" onClick={onPrev}>Quay lại</button>
            ) : null}
            <button type="button" className="btn-primary" onClick={isLast ? onClose : onNext}>
              {isLast ? 'Xong' : 'Tiếp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
