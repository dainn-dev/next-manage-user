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
  const callbackRef = useRef(onVehicleCheck)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onVehicleCheck
  }, [onVehicleCheck])

  useEffect(() => {
    const connect = () => {
      // Prevent multiple simultaneous connections
      if (isConnectingRef.current || clientRef.current?.connected) {
        return
      }

      isConnectingRef.current = true
      console.log('Attempting WebSocket connection...')

      // Create WebSocket connection using SockJS
      const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/ws`)
      
      const client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {},
        debug: (str) => {
          console.log('WebSocket Debug:', str)
        },
        // Disable automatic reconnect to prevent continuous connect/disconnect
        reconnectDelay: 0,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      })

      client.onConnect = (frame) => {
        console.log('WebSocket connected successfully:', frame)
        setIsConnected(true)
        setConnectionError(null)
        isConnectingRef.current = false

        // Subscribe to vehicle check topic
        client.subscribe('/topic/vehicle-check', (message) => {
          try {
            const vehicleCheckData: VehicleCheckMessage = JSON.parse(message.body)
            console.log('Received vehicle check:', vehicleCheckData)
            callbackRef.current?.(vehicleCheckData)
          } catch (error) {
            console.error('Error parsing vehicle check message:', error)
          }
        })
      }

      client.onStompError = (frame) => {
        console.error('WebSocket STOMP error:', frame.headers['message'])
        setConnectionError(frame.headers['message'] || 'Connection error')
        setIsConnected(false)
        isConnectingRef.current = false
        
        // Schedule reconnect after 10 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          connect()
        }, 10000)
      }

      client.onWebSocketError = (event) => {
        console.error('WebSocket error:', event)
        setConnectionError('WebSocket connection failed')
        setIsConnected(false)
        isConnectingRef.current = false
      }

      client.onDisconnect = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        isConnectingRef.current = false
      }

      clientRef.current = client
      client.activate()
    }

    // Initial connection
    connect()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (clientRef.current) {
        clientRef.current.deactivate()
        clientRef.current = null
      }
      isConnectingRef.current = false
    }
  }, []) // Remove onVehicleCheck from dependency array

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

  const reconnect = () => {
    if (clientRef.current) {
      clientRef.current.deactivate()
      clientRef.current = null
    }
    isConnectingRef.current = false
    
    // Wait a bit before reconnecting
    setTimeout(() => {
      const connect = () => {
        if (isConnectingRef.current || clientRef.current?.connected) {
          return
        }

        isConnectingRef.current = true
        console.log('Manual reconnection attempt...')

        const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/ws`)
        
        const client = new Client({
          webSocketFactory: () => socket,
          connectHeaders: {},
          debug: (str) => console.log('WebSocket Debug:', str),
          reconnectDelay: 0,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
        })

        client.onConnect = (frame) => {
          console.log('WebSocket reconnected successfully:', frame)
          setIsConnected(true)
          setConnectionError(null)
          isConnectingRef.current = false

          client.subscribe('/topic/vehicle-check', (message) => {
            try {
              const vehicleCheckData: VehicleCheckMessage = JSON.parse(message.body)
              console.log('Received vehicle check:', vehicleCheckData)
              callbackRef.current?.(vehicleCheckData)
            } catch (error) {
              console.error('Error parsing vehicle check message:', error)
            }
          })
        }

        client.onStompError = (frame) => {
          console.error('WebSocket STOMP error on reconnect:', frame.headers['message'])
          setConnectionError(frame.headers['message'] || 'Connection error')
          setIsConnected(false)
          isConnectingRef.current = false
        }

        client.onWebSocketError = (event) => {
          console.error('WebSocket error on reconnect:', event)
          setConnectionError('WebSocket connection failed')
          setIsConnected(false)
          isConnectingRef.current = false
        }

        client.onDisconnect = () => {
          console.log('WebSocket disconnected on reconnect')
          setIsConnected(false)
          isConnectingRef.current = false
        }

        clientRef.current = client
        client.activate()
      }
      
      connect()
    }, 1000)
  }

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect,
  }
}
