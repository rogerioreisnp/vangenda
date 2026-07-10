'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    OneSignalDeferred: any[]
    __oneSignalInited?: string
  }
}

export default function OneSignalInit({ motoristaId }: { motoristaId: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Evita reinit em navegação client-side dentro do mesmo user
    if (window.__oneSignalInited === motoristaId) return
    window.__oneSignalInited = motoristaId

    const existing = document.querySelector('script[data-onesignal-sdk]') as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    if (!existing) {
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
      script.defer = true
      script.setAttribute('data-onesignal-sdk', '1')
      document.head.appendChild(script)
    }

    const bootstrap = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId: 'e237058d-959e-4b55-a45a-d2250562b73f',
            allowLocalhostAsSecureOrigin: true,
          })
          await OneSignal.login(motoristaId)
          await OneSignal.User.addTag('motorista_id', motoristaId)

          // iOS Safari só entrega push se o site foi instalado como PWA
          // (Adicionar à tela de início) — em navegador comum a permissão
          // sempre volta como 'denied' silenciosamente.
          const perm = OneSignal.Notifications?.permission
          if (perm === false || perm === 'default' || typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
              await OneSignal.Notifications.requestPermission()
            } catch (e) {
              console.warn('[OneSignal] requestPermission falhou:', e)
            }
          }

          const optedIn = OneSignal.User?.PushSubscription?.optedIn
          if (optedIn === false) {
            try { await OneSignal.User.PushSubscription.optIn() } catch {}
          }

          console.log('[OneSignal] pronto | motorista_id:', motoristaId, '| permission:', OneSignal.Notifications?.permission)
        } catch (e) {
          console.error('[OneSignal] erro no bootstrap:', e)
        }
      })
    }

    if (existing) bootstrap()
    else script.onload = bootstrap
  }, [motoristaId])

  return null
}
