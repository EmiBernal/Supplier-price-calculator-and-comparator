export function currentRole() {
  try {
    return (localStorage.getItem("role") || "venta").toLowerCase();
  } catch {
    return "venta";
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = new Headers(init.headers || {});
  if (!headers.has("X-Role")) headers.set("X-Role", currentRole());
  return fetch(url, { ...init, headers, credentials: "include" });
}
