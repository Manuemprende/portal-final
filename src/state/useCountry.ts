// p.ej. src/state/useCountry.ts (o donde tengas el selector)
const FREE_COUNTRY = 'CL';

function canSeeCountry(code: string, session?: Session | null) {
  const role = session?.user?.app_metadata?.role || session?.user?.role;
  const plan = session?.user?.app_metadata?.plan;
  return code === FREE_COUNTRY || role === 'admin' || ['pro','enterprise'].includes(plan || '');
}

function onChangeCountry(code: string) {
  const ok = canSeeCountry(code, session);
  if (!ok) {
    toast('Disponible con suscripción');
    setCountry(FREE_COUNTRY);
    return;
  }
  setCountry(code);
}
