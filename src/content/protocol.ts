/**
 * Messages between the isolated-world content script and the main-world
 * bridge. Both sides run in the same page, so a synchronous CustomEvent
 * round trip is enough. Payloads are JSON strings because objects do not
 * cross JavaScript worlds.
 */
export const REQUEST_EVENT = 'gmw:request'
export const RESPONSE_EVENT = 'gmw:response'

export type BridgeRequest =
  | { id: string; op: 'get' }
  | { id: string; op: 'set'; text: string }
  | { id: string; op: 'focus' }

export interface BridgeResponse {
  id: string
  ok: boolean
  text?: string
  error?: string
}
