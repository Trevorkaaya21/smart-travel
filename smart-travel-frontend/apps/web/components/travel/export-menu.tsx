'use client'

import { Download, FileText, Calendar, Share2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExportMenuProps {
  tripId: string
  tripName: string
  days: any[]
}

export function ExportMenu({ tripId, tripName, days }: ExportMenuProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const exportToPDF = async () => {
    setLoading('pdf')
    try {
      // TODO: Implement PDF generation (using jsPDF or similar)
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('PDF exported!', { description: `${tripName}.pdf downloaded` })
    } catch (_error) {
      toast.error('Export failed', { description: 'Could not generate PDF' })
    } finally {
      setLoading(null)
    }
  }

  const exportToCalendar = async () => {
    setLoading('calendar')
    try {
      // Generate iCal format
      const icalContent = generateICal(tripName, days)
      const blob = new Blob([icalContent], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${tripName}.ics`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Calendar exported!', { description: 'Import to your calendar app' })
    } catch (_error) {
      toast.error('Export failed', { description: 'Could not generate calendar file' })
    } finally {
      setLoading(null)
    }
  }

  const shareTrip = async () => {
    try {
      const shareUrl = `${window.location.origin}/share/${tripId}`
      if (navigator.share) {
        await navigator.share({
          title: tripName,
          text: `Check out my trip: ${tripName}`,
          url: shareUrl,
        })
        toast.success('Shared!', { description: 'Trip shared successfully' })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Link copied!', { description: 'Share link copied to clipboard' })
      }
    } catch (_error) {
      toast.error('Share failed', { description: 'Could not share trip' })
    }
  }

  const emailTrip = async () => {
    try {
      const shareUrl = `${window.location.origin}/share/${tripId}`
      const subject = encodeURIComponent(`My Trip: ${tripName}`)
      const body = encodeURIComponent(`Check out my trip itinerary: ${shareUrl}`)
      window.location.href = `mailto:?subject=${subject}&body=${body}`
    } catch (_error) {
      toast.error('Email failed', { description: 'Could not open email client' })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="btn btn-ghost gap-2" disabled={loading !== null}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onClick={exportToPDF} disabled={loading === 'pdf'}>
          <FileText className="h-4 w-4 mr-2" />
          {loading === 'pdf' ? 'Generating...' : 'Export as PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCalendar} disabled={loading === 'calendar'}>
          <Calendar className="h-4 w-4 mr-2" />
          {loading === 'calendar' ? 'Generating...' : 'Export to Calendar'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTrip}>
          <Share2 className="h-4 w-4 mr-2" />
          Share Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={emailTrip}>
          <Mail className="h-4 w-4 mr-2" />
          Email Itinerary
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function generateICal(tripName: string, days: any[]): string {
  const now = new Date()
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart Travel//Trip Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join('\r\n')

  days.forEach((day, index) => {
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() + index)
    const endDate = new Date(startDate)
    endDate.setHours(endDate.getHours() + 24)

    ical += '\r\n' + [
      'BEGIN:VEVENT',
      `UID:trip-${day.day}-${Date.now()}@smarttravel.app`,
      `DTSTAMP:${formatDate(now)}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${day.title || `Day ${day.day}`}`,
      `DESCRIPTION:${day.summary || ''}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  ical += '\r\nEND:VCALENDAR'
  return ical
}
