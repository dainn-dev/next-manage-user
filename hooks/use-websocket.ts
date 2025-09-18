"use client"

import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

export interface VehicleCheckMessage {
  licensePlateNumber: string
  type: string
  timestamp: string
  message: string
}

export const useWebSocket = (onVehicleCheck?: (message: VehicleCheckMessage) => void) => {
  const clientRef = useRef<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    const connect = () => {
      // Create WebSocket connection using SockJS
      const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/ws`)
      
      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {},
        debug: (str) => {
          console.log('WebSocket Debug:', str)
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      })

      client.onConnect = (frame) => {
        console.log('WebSocket connected:', frame)
        setIsConnected(true)
        setConnectionError(null)

        // Subscribe to vehicle check topic
        client.subscribe('/topic/vehicle-check', (message) => {
          try {
            const vehicleCheckData: VehicleCheckMessage = JSON.parse(message.body)
            console.log('Received vehicle check:', vehicleCheckData)
            onVehicleCheck?.(vehicleCheckData)
          } catch (error) {
            console.error('Error parsing vehicle check message:', error)
          }
        })
      }

      client.onStompError = (frame) => {
        console.error('WebSocket STOMP error:', frame.headers['message'])
        setConnectionError(frame.headers['message'] || 'Connection error')
        setIsConnected(false)
      }

      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event)
        setConnectionError('WebSocket connection failed')
        setIsConnected(false)
      }

      client.onDisconnect = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
      }

      clientRef.current = client
      client.activate()
    }

    connect()

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate()
        clientRef.current = null
      }
    }
  }, [onVehicleCheck])

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

  return {
    isConnected,
    connectionError,
    sendMessage,
  }
}
