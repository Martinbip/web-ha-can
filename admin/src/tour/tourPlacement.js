// Phần tính toán thuần của tour: chọn bước nào chạy được và đặt bong bóng chú
// thích ở đâu. Tách khỏi React để chạy thẳng trong test, không cần dựng giao diện.

export const GAP = 12;            // khoảng hở giữa vùng được chỉ và bong bóng
export const EDGE = 16;           // lề tối thiểu so với mép màn hình
export const TOOLTIP_WIDTH = 330;
export const NARROW = 900;        // dưới ngưỡng này sidebar là ngăn kéo, không chỉ vào được
export const CARD_HEIGHT = 200;   // chiều cao ước lượng của bong bóng, đủ để không tràn màn hình

// Bỏ những bước không có mốc trên màn hình hiện tại. Bảng chưa có dòng nào, menu
// chưa có mục nào, bài viết không có ô ảnh — chỉ vào chỗ trống thì tệ hơn là im lặng.
export function resolveSteps(steps, root) {
  return steps.filter((step) => Boolean(root.querySelector(step.target)));
}

// Phần tử nằm ngoài khung nhìn (ngăn kéo menu đang đóng chẳng hạn) thì không chỉ
// vào được — lúc đó bong bóng đứng giữa màn hình và bỏ vòng sáng.
export function isOnScreen(rect, viewport) {
  if (!rect) return false;
  return rect.left < viewport.width && rect.left + rect.width > 0
    && rect.top < viewport.height && rect.top + rect.height > 0;
}

// Đặt bong bóng theo hướng mong muốn, nhưng nhường chỗ cho thực tế: hết chỗ bên
// phải thì rơi xuống dưới, hết chỗ dưới thì lật lên trên.
export function placeTooltip(rect, preferred, viewport) {
  const { width: vw, height: vh } = viewport;
  const width = Math.min(TOOLTIP_WIDTH, vw - EDGE * 2);
  let placement = vw < NARROW ? 'bottom' : preferred;

  if (placement === 'right' && rect.left + rect.width + GAP + width > vw - EDGE) placement = 'bottom';
  if (placement === 'left' && rect.left - GAP - width < EDGE) placement = 'bottom';
  if (placement === 'bottom' && rect.top + rect.height + GAP + CARD_HEIGHT > vh) placement = 'top';
  if (placement === 'top' && rect.top - GAP - CARD_HEIGHT < 0) placement = 'bottom';

  const clampX = (x) => Math.min(Math.max(x, EDGE), Math.max(EDGE, vw - width - EDGE));
  const clampY = (y) => Math.min(Math.max(y, EDGE), Math.max(EDGE, vh - EDGE));
  // Mốc cao gần hết màn hình (thanh menu bên trái) thì cả trên lẫn dưới đều thiếu
  // chỗ: hai hàm dưới kéo bong bóng về lại trong khung nhìn thay vì để nó rơi ra ngoài.
  const clampBelow = (y) => Math.min(Math.max(y, EDGE), Math.max(EDGE, vh - EDGE - CARD_HEIGHT));
  const clampAbove = (y) => Math.max(Math.min(y, vh - EDGE), Math.min(EDGE + CARD_HEIGHT, vh - EDGE));

  switch (placement) {
    case 'right':
      return { placement, width, left: rect.left + rect.width + GAP, top: clampY(rect.top + rect.height / 2), transform: 'translateY(-50%)' };
    case 'left':
      return { placement, width, left: rect.left - GAP, top: clampY(rect.top + rect.height / 2), transform: 'translate(-100%, -50%)' };
    case 'top':
      return { placement, width, left: clampX(rect.left), top: clampAbove(rect.top - GAP), transform: 'translateY(-100%)' };
    default:
      return { placement: 'bottom', width, left: clampX(rect.left), top: clampBelow(rect.top + rect.height + GAP), transform: 'none' };
  }
}

// Bong bóng đứng giữa màn hình khi không có mốc nào để chỉ vào.
export function centeredTooltip(viewport) {
  return {
    placement: 'center',
    width: Math.min(TOOLTIP_WIDTH, viewport.width - EDGE * 2),
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
  };
}
