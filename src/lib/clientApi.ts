/** 统一的客户端请求：遇到 401 自动跳回登录页 */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('UNAUTHORIZED');
  }
  return res;
}
