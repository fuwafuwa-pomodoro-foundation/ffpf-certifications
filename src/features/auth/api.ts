import { useQuery } from '@tanstack/react-query'

export type SessionUser = {
  name: string
  email: string
}

export type SessionResponse = {
  enabled: boolean
  user: SessionUser | null
}

export const sessionQueryKey = ['session'] as const

export async function getSession(): Promise<SessionResponse> {
  const response = await fetch('/api/auth/session', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('ログイン状態を確認できませんでした。')
  return response.json() as Promise<SessionResponse>
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/signout', { method: 'POST' })
  if (!response.ok) throw new Error('ログアウトできませんでした。')
}

export function signInUrl(next: string): string {
  return `/api/auth/signin?${new URLSearchParams({ next })}`
}

export function useSession() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: getSession })
}
