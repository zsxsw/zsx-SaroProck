import type { APIContext } from 'astro';
export async function POST({ request }: APIContext) {
  try {
    const { password } = await request.json();

    const secretPassword = import.meta.env.SECRET_ADMIN_PASSWORD;

    if (!secretPassword) {
      // 如果服务器没有配置密码，返回错误
      return new Response(JSON.stringify({ success: false, message: '服务器未配置密码。' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (password === secretPassword) {
      // 密码正确
      return new Response(JSON.stringify({ success: true, message: '验证成功' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // 密码错误
      return new Response(JSON.stringify({ success: false, message: '密码不正确' }), {
        status: 401, // 401 Unauthorized 是一个合适的状态码
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: '无效的请求' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}