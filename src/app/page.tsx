'use client'
import dynamic from 'next/dynamic'

const KeyTransform = dynamic(() => import('@/components/KeyTransform'), { ssr: false })

export default function Home() {
  return <KeyTransform />
}
