'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PremiumGate } from '@/components/premium/premium-gate'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface TravelAssistantProps {
  tripId?: string
  destination?: string
}

export function TravelAssistant({ tripId: _tripId, destination }: TravelAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI travel assistant. I can help you with travel tips, recommendations, itinerary optimization, and answer questions about ${destination || 'your trip'}. What would you like to know?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // TODO: Integrate with AI API (Gemini, OpenAI, etc.)
      await new Promise(resolve => setTimeout(resolve, 1500))

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateResponse(userMessage.content, destination),
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (_error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumGate feature="AI travel assistant">
      <div className="content-card p-0 flex flex-col h-[600px]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[rgb(var(--border))]/30">
          <div className="ui-liquid-icon">
            <Sparkles className="h-5 w-5 text-[rgb(var(--accent))]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[rgb(var(--text))]">AI Travel Assistant</h3>
            <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
              Ask me anything about your trip
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="ui-liquid-icon">
                  <Bot className="h-4 w-4 text-[rgb(var(--accent))]" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2',
                  message.role === 'user'
                    ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-contrast))]'
                    : 'bg-[rgb(var(--surface-muted))]/50 text-[rgb(var(--text))]'
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="ui-liquid-icon">
                  <User className="h-4 w-4 text-[rgb(var(--accent-secondary))]" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="ui-liquid-icon">
                <Bot className="h-4 w-4 text-[rgb(var(--accent))]" />
              </div>
              <div className="bg-[rgb(var(--surface-muted))]/50 rounded-2xl px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--accent))]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[rgb(var(--border))]/30">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask about your trip..."
              className="input-surface flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="btn btn-primary"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </PremiumGate>
  )
}

function generateResponse(userInput: string, destination?: string): string {
  const lowerInput = userInput.toLowerCase()
  
  if (lowerInput.includes('weather')) {
    return `For weather information in ${destination || 'your destination'}, I recommend checking a reliable weather service. Generally, it's good to pack layers and check the forecast a few days before your trip. Would you like me to help you plan your packing list based on the weather?`
  }
  
  if (lowerInput.includes('budget') || lowerInput.includes('cost') || lowerInput.includes('money')) {
    return `Budget planning is crucial! I can help you track expenses. A good rule of thumb is to allocate about 30% for accommodation, 30% for food, 20% for activities, and 20% for transportation. Would you like me to set up a budget tracker for your trip?`
  }
  
  if (lowerInput.includes('pack') || lowerInput.includes('luggage')) {
    return `Great question! For packing, I recommend making a list and checking items off as you pack. Essentials include: travel documents, chargers, weather-appropriate clothing, and any medications. Would you like me to generate a personalized packing list for your trip?`
  }
  
  if (lowerInput.includes('recommend') || lowerInput.includes('suggest') || lowerInput.includes('best')) {
    return `I'd be happy to help with recommendations! For ${destination || 'your destination'}, I suggest exploring local markets, trying authentic cuisine, and visiting cultural landmarks. Would you like specific recommendations based on your interests?`
  }
  
  return `That's a great question! I'm here to help you plan the perfect trip. I can assist with weather forecasts, budget tracking, packing lists, local recommendations, and itinerary optimization. What specific aspect of your trip would you like help with?`
}
