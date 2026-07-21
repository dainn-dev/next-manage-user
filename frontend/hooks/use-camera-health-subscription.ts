'use client'

import { useEffect, useState } from 'react'
import { Client, StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getApiUrl } from '@/lib/api/config'
import { useAuth } from '@/lib/auth-context'

const WS_URL = getApiUrl().replace('/api', '/ws')

export interface CameraHealthEvent {
  type: 'camera.health.changed'
  siteId: string
  cameraId: string
  agentId?: string
  status: 'online' | 'offline' | 'error'
  connectionState: string
  lastFrameAt?: string
  fps?: number
  errorCode?: string
  occurredAt: string
  version: number
}

export interface AgentStatusEvent {
  type: 'agent.online' | 'agent.offline' | 'agent.revoked'
  siteId: string
  agentId: string
  name: string
  version?: string
  occurredAt: string
}

export function useCameraHealthSubscription(
  siteId: string | null,
  onCameraHealth: (event: CameraHealthEvent) => void
) {
  const { token } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!siteId || !token) return

    const stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      debug: (str) => {
        console.log('[STOMP]', str)
      },
    })

    let subscription: StompSubscription | null = null

    stompClient.onConnect = () => {
      console.log('[Camera Health] Connected to WebSocket')
      setConnected(true)

      subscription = stompClient.subscribe(
        `/topic/site/${siteId}/cameras/health`,
        (message) => {
          try {
            const event: CameraHealthEvent = JSON.parse(message.body)
            onCameraHealth(event)
          } catch (error) {
            console.error('[Camera Health] Failed to parse message:', error)
          }
        }
      )
    }

    stompClient.onDisconnect = () => {
      console.log('[Camera Health] Disconnected from WebSocket')
      setConnected(false)
    }

    stompClient.onStompError = (frame) => {
      console.error('[Camera Health] STOMP error:', frame)
      setConnected(false)
    }

    stompClient.activate()
    setClient(stompClient)

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
      stompClient.deactivate()
    }
  }, [siteId, token, onCameraHealth])

  return { connected, client }
}

export function useAgentStatusSubscription(
  siteId: string | null,
  onAgentStatus: (event: AgentStatusEvent) => void
) {
  const { token } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!siteId || !token) return

    const stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
    })

    let subscription: StompSubscription | null = null

    stompClient.onConnect = () => {
      console.log('[Agent Status] Connected to WebSocket')
      setConnected(true)

      subscription = stompClient.subscribe(
        `/topic/site/${siteId}/agents`,
        (message) => {
          try {
            const event: AgentStatusEvent = JSON.parse(message.body)
            onAgentStatus(event)
          } catch (error) {
            console.error('[Agent Status] Failed to parse message:', error)
          }
        }
      )
    }

    stompClient.onDisconnect = () => {
      console.log('[Agent Status] Disconnected from WebSocket')
      setConnected(false)
    }

    stompClient.activate()
    setClient(stompClient)

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
      stompClient.deactivate()
    }
  }, [siteId, token, onAgentStatus])

  return { connected, client }
}
