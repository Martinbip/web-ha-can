// Menu được lưu dưới dạng cây 2 cấp, nhưng thao tác kéo thả dễ viết hơn nhiều
// trên một danh sách phẳng có cột `depth`. Hai hàm dưới đây chuyển qua lại giữa
// hai cách biểu diễn đó.

export const MAX_DEPTH = 1;

let idCounter = 0;

export function createRow(depth = 0) {
  idCounter += 1;
  return { key: `new-${idCounter}`, id: '', label: '', url: '/', visible: true, depth };
}

export function flattenTree(items) {
  const rows = [];
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const key = item.id || `item-${index}`;
    rows.push({
      key,
      id: item.id || '',
      label: item.label || '',
      url: item.url || '',
      visible: item.visible !== false,
      depth: 0,
    });
    (Array.isArray(item.children) ? item.children : []).forEach((child, childIndex) => {
      rows.push({
        key: child.id || `${key}-child-${childIndex}`,
        id: child.id || '',
        label: child.label || '',
        url: child.url || '',
        visible: child.visible !== false,
        depth: 1,
      });
    });
  });
  return rows;
}

export function buildTree(rows) {
  const items = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const node = {
      id: row.id || undefined,
      label: row.label,
      url: row.url,
      visible: row.visible !== false,
      children: [],
    };
    // Mục con mà phía trên chưa có mục cha nào thì tự lên cấp 1, thay vì biến mất.
    if (row.depth > 0 && items.length > 0) {
      items[items.length - 1].children.push(node);
    } else {
      items.push(node);
    }
  });
  return items;
}

// Một mục cấp 1 luôn kéo theo các mục con của nó.
export function getBlockLength(rows, index) {
  if (rows[index] && rows[index].depth > 0) return 1;
  let length = 1;
  while (index + length < rows.length && rows[index + length].depth > 0) length += 1;
  return length;
}

export function moveBlock(rows, from, to) {
  if (from === to) return rows;
  const length = getBlockLength(rows, from);
  if (to > from && to < from + length) return rows;

  const next = rows.slice();
  const block = next.splice(from, length);
  const target = to > from ? to - length : to;
  next.splice(Math.max(0, Math.min(target, next.length)), 0, ...block);
  return normalizeDepths(next);
}

export function indentRow(rows, index) {
  if (index <= 0) return rows;
  if (rows[index].depth > 0) return rows;
  // Không cho một mục đang có con tự trở thành mục con — cây chỉ sâu 2 cấp.
  if (getBlockLength(rows, index) > 1) return rows;
  const next = rows.slice();
  next[index] = { ...next[index], depth: 1 };
  return normalizeDepths(next);
}

export function outdentRow(rows, index) {
  if (!rows[index] || rows[index].depth === 0) return rows;
  const next = rows.slice();
  next[index] = { ...next[index], depth: 0 };
  return normalizeDepths(next);
}

export function removeRow(rows, index) {
  const length = getBlockLength(rows, index);
  const next = rows.slice();
  next.splice(index, length);
  return normalizeDepths(next);
}

// Mục con đứng đầu danh sách không có cha, kéo lên cấp 1 để hiển thị đúng
// những gì buildTree sẽ lưu.
export function normalizeDepths(rows) {
  let hasParent = false;
  return rows.map((row) => {
    if (row.depth > 0 && hasParent) return row;
    hasParent = true;
    return row.depth === 0 ? row : { ...row, depth: 0 };
  });
}

// Kéo thả không dùng được bằng bàn phím, nên mỗi mục còn có nút lên/xuống.
// Mục cấp 1 nhảy qua trọn khối kế bên (kể cả mục con), mục con chỉ đổi chỗ với
// anh em cùng cha.
function prevBlockStart(rows, index) {
  if (rows[index].depth > 0) {
    return index > 0 && rows[index - 1].depth > 0 ? index - 1 : -1;
  }
  for (let i = index - 1; i >= 0; i -= 1) {
    if (rows[i].depth === 0) return i;
  }
  return -1;
}

function nextBlockStart(rows, index) {
  const next = index + getBlockLength(rows, index);
  if (next >= rows.length) return -1;
  if (rows[index].depth > 0 && rows[next].depth === 0) return -1;
  return next;
}

export function canMoveUp(rows, index) {
  return prevBlockStart(rows, index) >= 0;
}

export function canMoveDown(rows, index) {
  return nextBlockStart(rows, index) >= 0;
}

export function moveUpRow(rows, index) {
  const target = prevBlockStart(rows, index);
  return target < 0 ? rows : moveBlock(rows, index, target);
}

export function moveDownRow(rows, index) {
  const next = nextBlockStart(rows, index);
  if (next < 0) return rows;
  return moveBlock(rows, index, next + getBlockLength(rows, next));
}
