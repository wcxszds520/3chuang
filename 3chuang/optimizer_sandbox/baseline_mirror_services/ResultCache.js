/**
 * Result Cache - AI Compliance Async Architecture
 * Version: 1.0.0
 * 
 * Provides abstraction over Redis and in-memory storage for async task results.
 * Supports automatic TTL cleanup and health checking.
 * 
 * Features:
 * - In-memory Map-based cache with 5-minute TTL
 * - Automatic cleanup using setTimeout for expired entries
 * - Health check support
 * - Simple interface: set, get, delete, isHealthy
 */

class ResultCache {
  constructor(config = {}) {
    this.mode = config.mode || 'memory'; // Start with in-memory only (Redis support can come later)
    this.cache = new Map();
    this.timers = new Map(); // Store cleanup timers
    
    console.log('[ResultCache] Initialized in memory mode');
  }

  /**
   * Store task data with TTL
   * @param {string} taskId - Task identifier
   * @param {Object} data - Task data to store
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
   * @returns {Promise<void>}
   */
  async set(taskId, data, ttl = 300) {
    try {
      // Store data with timestamp
      const entry = {
        data,
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttl * 1000)
      };
      
      this.cache.set(taskId, entry);
      
      // Clear existing timer if any
      if (this.timers.has(taskId)) {
        clearTimeout(this.timers.get(taskId));
      }
      
      // Set cleanup timer
      const timer = setTimeout(() => {
        this.cache.delete(taskId);
        this.timers.delete(taskId);
        console.log(`[ResultCache] Auto-cleaned expired task: ${taskId}`);
      }, ttl * 1000);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
      
      this.timers.set(taskId, timer);
      
      console.log(`[ResultCache] Stored task ${taskId} with TTL ${ttl}s`);
    } catch (error) {
      console.error(`[ResultCache] Error storing task ${taskId}:`, error.message);
      throw error;
    }
  }

  /**
   * Retrieve task data
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object|null>} - Task data or null if not found/expired
   */
  async get(taskId) {
    try {
      const entry = this.cache.get(taskId);
      
      if (!entry) {
        return null;
      }
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        // Clean up expired entry
        this.cache.delete(taskId);
        if (this.timers.has(taskId)) {
          clearTimeout(this.timers.get(taskId));
          this.timers.delete(taskId);
        }
        console.log(`[ResultCache] Task ${taskId} expired`);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.error(`[ResultCache] Error retrieving task ${taskId}:`, error.message);
      return null;
    }
  }

  /**
   * Delete task data
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  async delete(taskId) {
    try {
      this.cache.delete(taskId);
      
      // Clear timer if exists
      if (this.timers.has(taskId)) {
        clearTimeout(this.timers.get(taskId));
        this.timers.delete(taskId);
      }
      
      console.log(`[ResultCache] Deleted task ${taskId}`);
    } catch (error) {
      console.error(`[ResultCache] Error deleting task ${taskId}:`, error.message);
    }
  }

  /**
   * Check if cache is healthy
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    // For in-memory mode, always healthy
    return true;
  }

  /**
   * Get cache statistics (for monitoring)
   * @returns {Object}
   */
  getStats() {
    return {
      mode: this.mode,
      size: this.cache.size,
      activeTimers: this.timers.size
    };
  }
}

module.exports = ResultCache;
