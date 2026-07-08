"use client"

import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getWsUrl } from '@/lib/api/config'

export interface VehicleCheckMessage {
  licensePlateNumber: string
  type: string
  timestamp: string
  message: string
  // Present when the backend fanned the event out to a per-gate topic (Phase 3.2).
  gateId?: string
}

// Extended interface for employee info from backend
export interface EmployeeVehicleCheckMessage {
  // Employee information
  employeeId: string
  employeeName: string
  firstName?: string
  lastName?: string
  department: string
  position: string
  rank?: string
  jobTitle?: string
  militaryCivilian?: string
  phone: string
  email: string
  location?: string
  avatar?: string

  // Vehicle information
  vehicleId: string
  licensePlateNumber: string
  brand?: string
  model?: string
  color?: string
  vehicleType?: string
  year?: number
  registrationDate?: string
  expiryDate?: string

  // Latest log information
  logId?: string
  logType: string
  logTime?: string
  driverName?: string
  purpose?: string
  gateLocation?: string
  notes?: string
}

export const DEFAULT_VEHICLE_CHECK_TOPIC = '/topic/vehicle-check'

// Build the per-gate STOMP topic. Must match WebSocketService.gateTopic on the
// backend: "/topic/gate/{gateId}/check".
export const gateCheckTopic = (gateId: string) => `/topic/gate/${gateId}/check`

export interface UseWebSocketOptions {
  // STOMP destination to subscribe to. Defaults to the global vehicle-check
  // topic. Pass gateCheckTopic(gateId) for a per-gate kiosk. Changing the topic
  // tears down and re-establishes the connection.
  topic?: string
  // Fired every time the STOMP connection is (re)established — including after an
  // automatic reconnect. A per-gate kiosk uses this to replay events it may have
  // missed while disconnected via GET /api/gates/{id}/recent-checks.
  onConnect?: () => void
}

const RECONNECT_DELAY_MS = 5000

export const useWebSocket = (
  onVehicleCheck?: (message: VehicleCheckMessage | EmployeeVehicleCheckMessage) => void,
  options?: UseWebSocketOptions,
) => {
  const clientRef = useRef<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const callbackRef = useRef(onVehicleCheck)
  const onConnectRef = useRef(options?.onConnect)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)
  const unmountedRef = useRef(false)
  const connectFnRef = useRef<() => void>()

  const topic = options?.topic ?? DEFAULT_VEHICLE_CHECK_TOPIC
  const topicRef = useRef(topic)

  // Keep the latest callbacks/topic without forcing a reconnect on every render.
  useEffect(() => {
    callbackRef.current = onVehicleCheck
  }, [onVehicleCheck])

  useEffect(() => {
    onConnectRef.current = options?.onConnect
  }, [options?.onConnect])

  useEffect(() => {
    topicRef.current = topic
  }, [topic])

  useEffect(() => {
    unmountedRef.current = false

    const scheduleReconnect = () => {
      if (unmountedRef.current) return
      if (reconnectTimeoutRef.current) return
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        console.log('Attempting to reconnect WebSocket...')
        connect()
      }, RECONNECT_DELAY_MS)
    }

    const connect = () => {
      // Prevent multiple simultaneous connections
      if (unmountedRef.current) return
      if (isConnectingRef.current || clientRef.current?.connected) {
        return
      }

      isConnectingRef.current = true
      console.log('Attempting WebSocket connection to', topicRef.current)

      // Create WebSocket connection using SockJS
      const socket = new SockJS(getWsUrl())

      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {},
        debug: (str) => {
          console.log('WebSocket Debug:', str)
        },
        // We manage reconnection ourselves (below) so we can re-subscribe to the
        // active topic and fire onConnect for replay.
        reconnectDelay: 0,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      })

      client.onConnect = (frame) => {
        console.log('WebSocket connected successfully:', frame)
        setIsConnected(true)
        setConnectionError(null)
        isConnectingRef.current = false

        client.subscribe(topicRef.current, (message) => {
          try {
            const vehicleCheckData = JSON.parse(message.body)
            callbackRef.current?.(vehicleCheckData)
          } catch (error) {
            console.error('Error parsing vehicle check message:', error)
          }
        })

        // Notify the consumer AFTER the subscription is live so any replay it
        // triggers cannot race ahead of live events.
        try {
          onConnectRef.current?.()
        } catch (error) {
          console.error('Error in WebSocket onConnect handler:', error)
        }
      }

      client.onStompError = (frame) => {
        console.error('WebSocket STOMP error:', frame.headers['message'])
        setConnectionError(frame.headers['message'] || 'Connection error')
        setIsConnected(false)
        isConnectingRef.current = false
        scheduleReconnect()
      }

      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event)
        setConnectionError('WebSocket connection failed')
        setIsConnected(false)
        isConnectingRef.current = false
        scheduleReconnect()
      }

      client.onWebSocketClose = () => {
        console.log('WebSocket closed')
        setIsConnected(false)
        isConnectingRef.current = false
        scheduleReconnect()
      }

      client.onDisconnect = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        isConnectingRef.current = false
      }

      clientRef.current = client
      client.activate()
    }

    // Expose the current connect() to the manual reconnect() below.
    connectFnRef.current = connect

    // Initial connection
    connect()

    // Cleanup on unmount / topic change
    return () => {
      unmountedRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (clientRef.current) {
        clientRef.current.deactivate()
        clientRef.current = null
      }
      isConnectingRef.current = false
    }
    // Reconnect from scratch when the target topic changes (e.g. switching gate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  const sendMessage = (destination: string, body: any) => {
    if (clientRef.current && isConnected) {
      clientRef.current.publish({
        destination,
        body: JSON.stringify(body),
      })
    } else {
      console.warn('WebSocket not connected')
    }
  }

  // Manual reconnect: drop the current client and immediately re-run connect().
  const reconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (clientRef.current) {
      clientRef.current.deactivate()
      clientRef.current = null
    }
    isConnectingRef.current = false
    setTimeout(() => {
      connectFnRef.current?.()
    }, 500)
  }

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect,
  }
}
