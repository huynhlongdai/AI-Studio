import { useCallback, useEffect, useRef, useState } from 'react'

type VoiceResultEvent = Event & {
  results: {
    length: number
    [index: number]: {
      0: { transcript: string }
    }
  }
}

type VoiceErrorEvent = Event & { error: string }

interface VoiceRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: VoiceResultEvent) => void) | null
  onerror: ((event: VoiceErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type VoiceRecognitionConstructor = new () => VoiceRecognition

declare global {
  interface Window {
    SpeechRecognition?: VoiceRecognitionConstructor
    webkitSpeechRecognition?: VoiceRecognitionConstructor
  }
}

const errorText = (code: string) => {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Vui lòng cho phép truy cập micro để nhập bằng giọng nói.'
  if (code === 'audio-capture') return 'Không tìm thấy micro trên thiết bị.'
  if (code === 'no-speech') return 'Chưa nghe thấy giọng nói. Hãy thử nói gần micro hơn.'
  return 'Không thể nhận dạng giọng nói lúc này. Bạn vẫn có thể nhập bằng bàn phím.'
}

/** Speech-to-text for short Vietnamese messages. The user reviews text before sending. */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const recognition = useRef<VoiceRecognition | null>(null)
  const callback = useRef(onTranscript)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => { callback.current = onTranscript }, [onTranscript])
  useEffect(() => () => recognition.current?.abort(), [])

  const stop = useCallback(() => {
    recognition.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setError('Trình duyệt này chưa hỗ trợ nhập bằng giọng nói.')
      return
    }
    recognition.current?.abort()
    const next = new Recognition()
    recognition.current = next
    next.lang = 'vi-VN'
    next.continuous = false
    next.interimResults = false
    next.onstart = () => { setListening(true); setError('') }
    next.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript).join(' ').trim()
      if (text) callback.current(text)
    }
    next.onerror = (event) => {
      setListening(false)
      setError(errorText(event.error))
    }
    next.onend = () => setListening(false)
    try {
      next.start()
    } catch {
      setError('Micro đang được sử dụng. Vui lòng thử lại.')
      setListening(false)
    }
  }, [])

  return { supported, listening, error, start, stop, toggle: listening ? stop : start }
}
