export function currency(num) {
  const n = Number(num) || 0;
  return n.toLocaleString();
}
