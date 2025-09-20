/**
 * Centralized API Configuration
 * This file consolidates all API-related environment variables into a single configuration
 */

// Single source of truth for API configuration
const API_CONFIG = {
  // Base URL for the backend API (without /api suffix)
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  
  // Full API URL (with /api suffix)
  API_URL: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api',
  
  // WebSocket URL
  WS_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  
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
  const baseUrl = API_CONFIG.BASE_URL || 'http://localhost:8080'
  
  // If imagePath already starts with http, return as-is
  if (imagePath.startsWith('http')) {
    return imagePath
  }
  
  // If imagePath doesn't start with /, add it
  const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`
  
  const fullUrl = `${baseUrl}${normalizedPath}`
  console.log('🖼️ Image URL generated:', { imagePath, baseUrl, fullUrl })
  
  return fullUrl
}

// Export the config for direct access if needed
export default API_CONFIG
