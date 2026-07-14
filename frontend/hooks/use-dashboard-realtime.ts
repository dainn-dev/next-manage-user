"use client"

import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authApi } from '@/lib/api/auth-api'
import { getWsUrl } from '@/lib/api/config'

export type RealtimeState = 'connecting' | 'live' | 'polling' | 'disconnected'

export function useDashboardRealtime(
  siteId: string | null,
  onSlot: (payload: unknown) => void,
  onEvent: (payload: unknown) => void,
  onReconnect: () => void,
) {
  const [state, setState] = useState<RealtimeState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const callbacks = useRef({ onSlot, onEvent, onReconnect })
  callbacks.current = { onSlot, onEvent, onReconnect }

  useEffect(() => {
    if (!siteId) {
      setState('disconnected')
      return
    }
    setState('connecting')
    const client = new Client({
      webSocketFactory: () => new SockJS(getWsUrl()),
      connectHeaders: authApi.getToken() ? { Authorization: `Bearer ${authApi.getToken()}` } : {},
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })
    client.onConnect = () => {
      setState('live')
      setError(null)
      client.subscribe(`/topic/site/${siteId}/slots`, (message) => {
        try { callbacks.current.onSlot(JSON.parse(message.body)) } catch { /* malformed event ignored */ }
      })
      client.subscribe(`/topic/site/${siteId}/events`, (message) => {
        try { callbacks.current.onEvent(JSON.parse(message.body)) } catch { /* malformed event ignored */ }
      })
      callbacks.current.onReconnect()
    }
    const disconnected = (message: string) => {
      setState('polling')
      setError(message)
    }
    client.onStompError = (frame) => disconnected(frame.headers.message || 'STOMP disconnected')
    client.onWebSocketError = () => disconnected('WebSocket unavailable; using polling')
    client.onWebSocketClose = () => disconnected('WebSocket disconnected; using polling')
    client.activate()
    return () => { void client.deactivate() }
  }, [siteId])

  return { state, error }
}
