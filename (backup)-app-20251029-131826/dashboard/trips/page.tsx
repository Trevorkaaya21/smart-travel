'use client'
import * as React from 'react'
import Link from 'next/link'
import { TripList } from '@/components/trip/trip-list'

export const dynamic = 'force-dynamic'

export default function TripsPage() {
  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Trips</h1>
        <Link href="/dashboard" className="btn">
          ← Dashboard
        </Link>
      </div>
      <TripList />
    </main>
  )
}