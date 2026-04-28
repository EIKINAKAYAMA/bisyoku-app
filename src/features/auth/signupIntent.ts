// /signup → Google OAuth → /auth/callback の往復で合言葉と分岐意図を保持するための
// sessionStorage キーをここに集約する。

const PASSPHRASE_KEY = 'signup_passphrase'
const INTENT_KEY = 'auth_intent'

export function setSignupIntent(passphrase: string): void {
  sessionStorage.setItem(PASSPHRASE_KEY, passphrase)
  sessionStorage.setItem(INTENT_KEY, 'signup')
}

export function readSignupIntent(): { intent: string | null; passphrase: string | null } {
  return {
    intent: sessionStorage.getItem(INTENT_KEY),
    passphrase: sessionStorage.getItem(PASSPHRASE_KEY),
  }
}

export function clearSignupIntent(): void {
  sessionStorage.removeItem(INTENT_KEY)
  sessionStorage.removeItem(PASSPHRASE_KEY)
}
