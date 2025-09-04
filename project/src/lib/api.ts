export function currentRole(){
  try {
    return (localStorage.getItem('role') || 'venta').toLowerCase();
  } catch {
    return 'venta';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}){
  const url = path.startsWith('http') ? path : `http://localhost:4000${path}`;
  const headers = new Headers(init.headers || {});
  if(!headers.has('X-Role')) headers.set('X-Role', currentRole());
  return fetch(url, { ...init, headers, credentials: 'include' });
}
