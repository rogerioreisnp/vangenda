'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    OneSignalDeferred: any[]
  }
}

export default function OneSignalInit({ motoristaId }: { motoristaId: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.init({
          appId: 'e237058d-959e-4b55-a45a-d2250562b73f',
          allowLocalhostAsSecureOrigin: true,
        })
        await OneSignal.login(motoristaId)
        await OneSignal.User.addTag('motorista_id', motoristaId)
      })
    }
  }, [motoristaId])

  return null
}
