export default function esCompat(m) {
  return m?.__esModule ? m : { default: m, ...m };
}
