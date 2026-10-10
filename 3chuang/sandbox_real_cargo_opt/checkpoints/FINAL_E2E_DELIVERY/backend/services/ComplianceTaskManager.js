/**
 * Compliance Task Manager - AI Compliance Async Architecture
 * Version: 1.0.0
 * 
 * Manages async task lifecycle for AI compliance checks.
 * Wraps existing AIComplianceService without reimplementing.
 * 
 * Features:
 * - Generate UUID v4 task IDs using crypto.randomUUID()
 * - Fire-and-forget async execution pattern
 * - 30-second timeout using Promise.race()
 * - Automatic Result Cache updates on completion/failure
 */

const crypto = require('crypto');

class ComplianceTaskManager {
  constructor(resultCache, aiComplianceService) {
    this.resultCache = resultCache;
    this.aiComplianceService = aiComplianceService;
    
    console.log('[ComplianceTaskManager] Initialized');
  }

  /**
   * Create a new async compliance check task
   * Task 15: Add logging for observability
   * @param {Object} packingPlanData - Full packing plan data
   * @returns {string} taskId - Unique task identifier (UUID v4)
   */
  createTask(packingPlanData) {
    // Generate UUID v4 task ID
    const taskId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // Store initial task metadata with "processing" status
    this.resultCache.set(taskId, {
      taskId,
      status: 'processing',
      createdAt: timestamp,
      updatedAt: timestamp
    }).catch(error => {
      console.error(`[ComplianceTaskManager] Failed to store initial task ${taskId}:`, error.message);
    });
    
    // Task 15: Log task creation with task ID and timestamp
    console.log(`[ComplianceTaskManager] Task created: ${taskId} at ${timestamp}`);
    
    return taskId;
  }

  /**
   * Execute compliance check asynchronously (FIRE-AND-FORGET)
   * CRITICAL: This method should NOT be awaited by the caller
   * Task 13: Add comprehensive error handling
   * @param {string} taskId - Task identifier
   * @param {Object} packingPlanData - Full packing plan data
   * @returns {Promise<void>} - Resolves when task completes or fails
   */
  async executeTask(taskId, packingPlanData) {
    const startTime = Date.now();
    console.log(`[ComplianceTaskManager] Executing task ${taskId}`);
    
    try {
      // Create 30-second timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('AI service timeout after 20 seconds'));
        }, 20000);
      });
      
      // Race between AI service call and timeout
      const aiPromise = this.aiComplianceService.generateComplianceReport(packingPlanData);
      
      const complianceReport = await Promise.race([aiPromise, timeoutPromise]);
      
      // Success - update cache with completed status
      const duration = Date.now() - startTime;
      await this.resultCache.set(taskId, {
        taskId,
        status: 'completed',
        complianceReport,
        createdAt: new Date(startTime).toISOString(),
        updatedAt: new Date().toISOString(),
        duration
      });
      
      // Task 15: Log task completion with task ID, duration, and status
      console.log(`[ComplianceTaskManager] Task completed: ${taskId}, duration: ${duration}ms, status: completed`);
      
    } catch (error) {
      // Task 13: Comprehensive error handling
      const duration = Date.now() - startTime;
      
      // Determine error type
      let errorMessage = 'AI service unavailable';
      if (error.message.includes('timeout')) {
        errorMessage = 'AI service timeout';
        console.error(`[ComplianceTaskManager] Task ${taskId} timeout after ${duration}ms`);
        // Task 15: Log polling timeout event
        console.warn(`[ComplianceTaskManager] Polling timeout event: ${taskId}`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'AI service connection failed';
        console.error(`[ComplianceTaskManager] Task ${taskId} connection failure:`, error.code);
      } else if (error.response && error.response.status >= 400) {
        errorMessage = 'AI service returned error';
        console.error(`[ComplianceTaskManager] Task ${taskId} HTTP error:`, error.response.status);
      } else {
        console.error(`[ComplianceTaskManager] Task ${taskId} unexpected error:`, error.message);
      }
      
      // Update cache with failed status (do NOT expose error details to frontend)
      await this.resultCache.set(taskId, {
        taskId,
        status: 'failed',
        error: errorMessage, // Generic message only
        createdAt: new Date(startTime).toISOString(),
        updatedAt: new Date().toISOString(),
        duration
      });
      
      // Task 15: Log task completion with task ID, duration, and status
      console.log(`[ComplianceTaskManager] Task completed: ${taskId}, duration: ${duration}ms, status: failed`);
      
      // Log full error server-side only
      console.error(`[ComplianceTaskManager] Task ${taskId} failed after ${duration}ms:`, error.message);
      console.error(`[ComplianceTaskManager] Error stack:`, error.stack);
    }
  }

  /**
   * Get task status and result
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object|null>} - Task status object or null if not found
   */
  async getTaskStatus(taskId) {
    try {
      const taskData = await this.resultCache.get(taskId);
      
      if (!taskData) {
        return null;
      }
      
      // Return task status based on current state
      if (taskData.status === 'completed') {
        return {
          status: 'completed',
          complianceReport: taskData.complianceReport
        };
      } else if (taskData.status === 'failed') {
        return {
          status: 'failed',
          error: taskData.error
        };
      } else {
        return {
          status: 'processing'
        };
      }
      
    } catch (error) {
      console.error(`[ComplianceTaskManager] Error getting task status ${taskId}:`, error.message);
      return null;
    }
  }
}

module.exports = ComplianceTaskManager;
