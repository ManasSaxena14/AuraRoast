'use server';

import { signIn, signOut } from '@/auth';

/** Only same-site paths: `//evil.example` and `https://…` are not "back". */
function safeRedirect(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/account';
}

export async function signInWithGoogle(formData: FormData) {
  await signIn('google', { redirectTo: safeRedirect(formData.get('redirectTo')) });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
