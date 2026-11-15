import { useCallback, useEffect, useRef, useState } from 'react'

/** Poll `fn` every `ms` while mounted; returns [data, error, reload]. */
export function usePolling(fn, ms, key) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(async () => {
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [])
  useEffect(() => {
    reload()
    const id = setInterval(reload, ms)
    return () => clearInterval(id)
  }, [reload, ms, key])
  return [data, error, reload]
}
