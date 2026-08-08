'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

import { speakingApi } from '@/lib/speaking-api'

import { initialSpeakingState, speakingMachine } from './speaking-machine'

export type SessionOperation = {
  epoch: number
  signal: AbortSignal
}

type UseSpeakingControllerOptions = {
  historyError: (reason: unknown) => string
  isAbortError: (reason: unknown) => boolean
}

export function useSpeakingController({
  historyError,
  isAbortError,
}: UseSpeakingControllerOptions) {
  const [state, dispatch] = useReducer(speakingMachine, initialSpeakingState)
  const mountedRef = useRef(true)
  const operationControllerRef = useRef<AbortController | null>(null)
  const operationEpochRef = useRef(0)
  const historyControllerRef = useRef<AbortController | null>(null)

  const cancelSessionOperation = useCallback(() => {
    operationEpochRef.current += 1
    operationControllerRef.current?.abort()
    operationControllerRef.current = null
  }, [])

  const beginSessionOperation = useCallback((): SessionOperation => {
    operationControllerRef.current?.abort()
    const controller = new AbortController()
    operationControllerRef.current = controller
    const epoch = ++operationEpochRef.current
    return { epoch, signal: controller.signal }
  }, [])

  const operationIsCurrent = useCallback((operation: SessionOperation) => {
    return (
      mountedRef.current &&
      !operation.signal.aborted &&
      operationEpochRef.current === operation.epoch
    )
  }, [])

  const loadHistory = useCallback(async () => {
    historyControllerRef.current?.abort()
    const controller = new AbortController()
    historyControllerRef.current = controller
    dispatch({ type: 'history_loading' })
    try {
      const sessions = await speakingApi.listSessions(controller.signal)
      if (mountedRef.current && !controller.signal.aborted) {
        dispatch({ type: 'history_loaded', sessions })
      }
    } catch (reason) {
      if (
        mountedRef.current &&
        !controller.signal.aborted &&
        !isAbortError(reason)
      ) {
        dispatch({
          type: 'history_failed',
          message: historyError(reason),
        })
      }
    }
  }, [historyError, isAbortError])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationEpochRef.current += 1
      operationControllerRef.current?.abort()
      historyControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  return {
    beginSessionOperation,
    cancelSessionOperation,
    dispatch,
    loadHistory,
    mountedRef,
    operationEpochRef,
    operationIsCurrent,
    state,
  }
}
