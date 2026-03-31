import type { PlayerAction, GameState } from '@game/shared'

const API_BASE = '/api'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

// Typed API calls
export function createGame() {
  return post<{ gameId: string; state: GameState }>('/games')
}

export function getGame(id: string) {
  return get<{ state: GameState }>(`/games/${id}`)
}

export function submitAction(gameId: string, action: PlayerAction) {
  return post<{ state: GameState }>(`/games/${gameId}/action`, action)
}

export function getSSEUrl(gameId: string): string {
  return `${API_BASE}/games/${gameId}/stream`
}
