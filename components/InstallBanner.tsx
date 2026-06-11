'use client'

import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Verifica se já está instalado (rodando como app)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore - propriedade específica do iOS
      window.navigator.standalone === true

    if (isStandalone) return

    // Verifica se o usuário já fechou o banner antes
    const dismissed = localStorage.getItem('vangenda-install-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      // Mostra de novo só depois de 7 dias
      if (Date.now() - dismissedTime < sevenDays) return
    }

    // Detecta iOS
    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    setIsIOS(ios)

    // Mostra o banner depois de 2 segundos (não atrapalha o cliente)
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('vangenda-install-dismissed', Date.now().toString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#0F6E56',
        color: '#fff',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '22px' }}>🚐</span>
        <div style={{ lineHeight: '1.3' }}>
          <strong style={{ display: 'block', marginBottom: '2px' }}>
            Instale o RotaGenda no seu celular
          </strong>
          <span style={{ fontSize: '12px', opacity: 0.9 }}>
            {isIOS
              ? 'Toque em "Compartilhar" e depois em "Adicionar à Tela de Início"'
              : 'Toque no menu (⋮) do navegador e escolha "Adicionar à tela inicial"'}
          </span>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
