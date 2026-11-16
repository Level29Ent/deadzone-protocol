'use client'

import dynamic from 'next/dynamic'

const Game = dynamic(() => import('./game'), {
  ssr: false,
  loading: () => <main className="game-shell"><div className="boot-screen"><div className="boot-mark">DZ</div><div className="boot-title">DEADZONE PROTOCOL</div><div className="boot-bar"><span /></div><div className="boot-label">INITIALIZING SURVIVAL SYSTEMS</div></div></main>,
})

export default function Page() {
  return <Game />
}
