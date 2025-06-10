import { useState, useCallback, useRef } from 'react'
import { apiClient } from '@/services/api'
import type { 
  WorkflowExecutionRequest, 
  WorkflowExecutionResponse, 
  WorkflowStatus,
  WorkflowProgress,
  MeetingIntelligenceInput,
  MeetingIntelligenceOutput
} from '@/types/api'

interface UseWorkflowReturn {
  isExecuting: boolean
  progress: WorkflowProgress | null
  result: any | null
  error: string | null
  executeWorkflow: (request: WorkflowExecutionRequest) => Promise<WorkflowExecutionResponse | null>
  executeMeetingIntelligence: (request: MeetingIntelligenceInput) => Promise<boolean>
  cancelWorkflow: () => Promise<boolean>
  clearResult: () => void
  clearError: () => void
}

interface WorkflowProgress {
  progress: number
  currentStep: string
  status: string
  stepResults?: any
  executionId?: string
}

export function useWorkflow(): UseWorkflowReturn {
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState<WorkflowProgress | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentExecutionId = useRef<string | null>(null)

  const executeWorkflow = useCallback(async (request: WorkflowExecutionRequest): Promise<WorkflowExecutionResponse | null> => {
    setIsExecuting(true)
    setError(null)
    setProgress({ progress: 0, currentStep: 'Starting...', status: 'pending' })
    setResult(null)

    try {
      // Start workflow execution
      const response = await apiClient.workflows.execute(request)
      currentExecutionId.current = response.execution_id

      // Start polling for progress if we got an execution ID
      if (response.execution_id) {
        pollWorkflowProgress(response.execution_id)
      }

      return response

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute workflow'
      setError(errorMessage)
      setIsExecuting(false)
      setProgress(null)
      return null
    }
  }, [])

  const executeMeetingIntelligence = useCallback(async (request: MeetingIntelligenceInput): Promise<boolean> => {
    setIsExecuting(true)
    setError(null)
    setProgress({ progress: 0, currentStep: 'Starting analysis...', status: 'pending' })
    setResult(null)

    try {
      // Start Meeting Intelligence workflow execution
      const response = await apiClient.meetingIntelligence.execute(request)
      currentExecutionId.current = response.workflow_id

      // Start polling for progress if we got a workflow ID
      if (response.workflow_id) {
        pollMeetingIntelligenceProgress(response.workflow_id)
      }

      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute Meeting Intelligence workflow'
      setError(errorMessage)
      setIsExecuting(false)
      setProgress(null)
      return false
    }
  }, [])

  const pollWorkflowProgress = useCallback(async (executionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        // Don't continue polling if execution was cancelled
        if (currentExecutionId.current !== executionId) {
          clearInterval(pollInterval)
          return
        }

        const status = await apiClient.workflows.getStatus(executionId)
        
        // Update progress
        setProgress({
          progress: status.progress || 0,
          currentStep: status.current_step || 'Processing...',
          status: status.status,
          stepResults: status.step_results,
          executionId: executionId
        })

        // Check if workflow is complete
        if (status.status === 'completed') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          
          // Get final results
          try {
            const finalResults = await apiClient.workflows.getResults(executionId)
            setResult(finalResults)
            setProgress(prev => prev ? { ...prev, progress: 100, currentStep: 'Completed', status: 'completed' } : null)
          } catch (resultError) {
            console.warn('Failed to get final results:', resultError)
            setResult({ message: 'Workflow completed but results could not be retrieved' })
          }
          
          currentExecutionId.current = null
        } else if (status.status === 'failed') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          setError(status.error || 'Workflow execution failed')
          setProgress(prev => prev ? { ...prev, status: 'failed' } : null)
          currentExecutionId.current = null
        } else if (status.status === 'cancelled') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          setProgress(prev => prev ? { ...prev, status: 'cancelled' } : null)
          currentExecutionId.current = null
        }

      } catch (err) {
        console.error('Error polling workflow status:', err)
        // Don't stop polling on temporary errors, but log them
      }
    }, 2000) // Poll every 2 seconds

    // Clean up interval after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval)
      if (isExecuting) {
        setError('Workflow monitoring timed out')
        setIsExecuting(false)
      }
    }, 5 * 60 * 1000)
  }, [isExecuting])

  const pollMeetingIntelligenceProgress = useCallback(async (workflowId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        // Don't continue polling if execution was cancelled
        if (currentExecutionId.current !== workflowId) {
          clearInterval(pollInterval)
          return
        }

        const status = await apiClient.meetingIntelligence.getStatus(workflowId)
        
        // Update progress
        setProgress({
          progress: status.progress || 0,
          currentStep: status.current_step || 'Processing...',
          status: status.status,
          stepResults: status.step_results,
          executionId: workflowId
        })

        // Check if workflow is complete
        if (status.status === 'completed') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          
          // Get final results
          try {
            const finalResults = await apiClient.meetingIntelligence.getResults(workflowId)
            setResult(finalResults)
            setProgress(prev => prev ? { ...prev, progress: 100, currentStep: 'Completed', status: 'completed' } : null)
          } catch (resultError) {
            console.warn('Failed to get final results:', resultError)
            setResult({ message: 'Workflow completed but results could not be retrieved' })
          }
          
          currentExecutionId.current = null
        } else if (status.status === 'failed') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          setError('Workflow execution failed')
          setProgress(prev => prev ? { ...prev, status: 'failed' } : null)
          currentExecutionId.current = null
        } else if (status.status === 'cancelled') {
          clearInterval(pollInterval)
          setIsExecuting(false)
          setProgress(prev => prev ? { ...prev, status: 'cancelled' } : null)
          currentExecutionId.current = null
        }

      } catch (err) {
        console.error('Error polling Meeting Intelligence status:', err)
        // Don't stop polling on temporary errors, but log them
      }
    }, 2000) // Poll every 2 seconds

    // Clean up interval after 5 minutes to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval)
      if (isExecuting) {
        setError('Workflow monitoring timed out')
        setIsExecuting(false)
      }
    }, 5 * 60 * 1000)
  }, [isExecuting])

  const cancelWorkflow = useCallback(async (): Promise<boolean> => {
    if (!currentExecutionId.current) {
      return false
    }

    try {
      // Try Meeting Intelligence cancellation first, then fall back to general workflow cancellation
      try {
        await apiClient.meetingIntelligence.cancel(currentExecutionId.current)
      } catch {
        await apiClient.workflows.cancel(currentExecutionId.current)
      }
      
      currentExecutionId.current = null
      setIsExecuting(false)
      setProgress(prev => prev ? { ...prev, status: 'cancelled' } : null)
      return true
    } catch (err) {
      console.error('Error cancelling workflow:', err)
      return false
    }
  }, [])

  const clearResult = useCallback(() => {
    setResult(null)
    setProgress(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isExecuting,
    progress,
    result,
    error,
    executeWorkflow,
    executeMeetingIntelligence,
    cancelWorkflow,
    clearResult,
    clearError,
  }
}