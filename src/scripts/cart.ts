/**
 * Bolsa de compras en localStorage. Sin framework: los pages la leen
 * y renderizan vía app.ts en cada astro:page-load.
 */
export type CartItem = {
  slug: string;
  title: string;
  price: number;
  size: string | null;
  qty: number;
  image: string;
};

const KEY = 'enigma:cart';

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: CartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:change'));
}

export function addToCart(item: Omit<CartItem, 'qty'>): void {
  const items = getCart();
  const existing = items.find((i) => i.slug === item.slug && i.size === item.size);
  if (existing) existing.qty += 1;
  else items.push({ ...item, qty: 1 });
  save(items);
}

export function setQty(slug: string, size: string | null, qty: number): void {
  let items = getCart();
  if (qty <= 0) {
    items = items.filter((i) => !(i.slug === slug && i.size === size));
  } else {
    const item = items.find((i) => i.slug === slug && i.size === size);
    if (item) item.qty = qty;
  }
  save(items);
}

export function clearCart(): void {
  save([]);
}

/** Unidades de una variante concreta (pieza + talle) ya en la bolsa. */
export function cartQty(slug: string, size: string | null): number {
  return getCart().find((i) => i.slug === slug && i.size === size)?.qty ?? 0;
}

export function cartCount(): number {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

export function cartTotal(): number {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
}
