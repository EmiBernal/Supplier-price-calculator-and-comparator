export function currentRole(): "compra" | "venta" | null {
  try {
    const stored = localStorage.getItem("role");
    return stored === "venta" || stored === "compra" ? stored : null;
  } catch {
    return null;
  }
}

const API_BASE_URL = (() => {
  const rawEnv = import.meta.env.VITE_API_URL ?? '';
  const fallback = 'https://calculadoragampackback.onrender.com';
  const raw = rawEnv || fallback;
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
})();

export { API_BASE_URL };

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http')
    ? path
    : API_BASE_URL
      ? `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
      : path;
  const headers = new Headers(init.headers || {});
  const role = currentRole();
  if (!headers.has("X-Role") && role) headers.set("X-Role", role);
  return fetch(url, { ...init, headers, credentials: "include" });
}
