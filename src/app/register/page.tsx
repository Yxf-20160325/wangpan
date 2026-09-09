import RegisterForm from '@/components/RegisterForm';
import { getSettings } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const settings = await getSettings();
  return <RegisterForm allowRegister={settings.allowRegister} />;
}
