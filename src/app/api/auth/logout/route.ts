export const dynamic = 'force-dynamic';
import { success } from '@/lib/api-response';

export async function POST() {
  const response = success({ message: 'Logged out' });

  // Clear both tokens
  for (const name of ['token', 'refresh_token']) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
  }

  return response;
}
