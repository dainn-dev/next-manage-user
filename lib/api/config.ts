/**
 * Centralized API Configuration
 * This file consolidates all API-related environment variables into a single configuration
 */

// Single source of truth for API configuration
const DEFAULT_BASE_URL = 'http://192.168.1.60:8080'

const API_CONFIG = {
  // Base URL for the backend API (without /api suffix)
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL,
  
  // Full API URL (with /api suffix)
  API_URL: (process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL) + '/api',
  
  // WebSocket URL
  WS_URL: process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL,
  
  // Timeout for API requests
  TIMEOUT: 10000,
}

// Helper functions to get API endpoints
export const getApiUrl = () => API_CONFIG.API_URL
export const getBaseUrl = () => API_CONFIG.BASE_URL
export const getWsUrl = () => `${API_CONFIG.WS_URL}/ws`
export const getImageUrl = (imagePath?: string) => {
  if (!imagePath) return null
  
  // Ensure we have a proper base URL
  const baseUrl = API_CONFIG.BASE_URL || DEFAULT_BASE_URL
  
  // If imagePath already starts with http, return as-is
  if (imagePath.startsWith('http')) {
    return imagePath
  }
  
  // If imagePath doesn't start with /, add it
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`
  
  const fullUrl = `${baseUrl}${normalizedPath}`
  
  return fullUrl
}

// Export the config for direct access if needed
export default API_CONFIG
