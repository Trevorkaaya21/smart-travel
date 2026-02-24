/**
 * Reviews Component
 * Display and manage place reviews with ratings
 */

'use client'

import * as React from 'react'
import { Star, ThumbsUp, ThumbsDown, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Review = {
  id: string
  user_email: string
  rating: number
  title?: string
  review_text?: string
  photos?: string[]
  visit_date?: string
  is_verified: boolean
  helpful_count: number
  not_helpful_count: number
  response_text?: string
  response_date?: string
  created_at: string
  user_name?: string
  user_avatar?: string
}

type ReviewsProps = {
  placeId: string
  placeName: string
  userEmail?: string
  initialReviews?: Review[]
}

export function Reviews({ placeId, placeName, userEmail, initialReviews = [] }: ReviewsProps) {
  const [reviews, setReviews] = React.useState<Review[]>(initialReviews)
  const [isWriting, setIsWriting] = React.useState(false)
  const [rating, setRating] = React.useState(0)
  const [hoverRating, setHoverRating] = React.useState(0)
  const [title, setTitle] = React.useState('')
  const [reviewText, setReviewText] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const stats = React.useMemo(() => {
    if (reviews.length === 0) {
      return { average: 0, distribution: [0, 0, 0, 0, 0], total: 0 }
    }

    const distribution = [0, 0, 0, 0, 0]
    let sum = 0

    reviews.forEach((review) => {
      distribution[review.rating - 1]++
      sum += review.rating
    })

    return {
      average: sum / reviews.length,
      distribution,
      total: reviews.length,
    }
  }, [reviews])

  const handleSubmitReview = async () => {
    if (!userEmail) {
      toast.error('Please sign in to write a review')
      return
    }

    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    if (!reviewText.trim()) {
      toast.error('Please write a review')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          place_id: placeId,
          rating,
          title: title.trim() || null,
          review_text: reviewText.trim(),
        }),
      })

      if (!response.ok) throw new Error('Failed to submit review')

      const newReview = await response.json()
      setReviews([newReview, ...reviews])
      
      // Reset form
      setRating(0)
      setTitle('')
      setReviewText('')
      setIsWriting(false)
      
      toast.success('Review submitted!', {
        description: 'Thank you for sharing your experience',
      })
    } catch (error) {
      toast.error('Failed to submit review', {
        description: 'Please try again later',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Rating Overview */}
      <div className="content-card">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Average Rating */}
          <div className="flex flex-col items-center justify-center gap-4 border-r border-[rgb(var(--border))]/20 pr-6">
            <div className="text-6xl font-bold text-[rgb(var(--accent))]">
              {stats.average.toFixed(1)}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-6 w-6',
                    star <= Math.round(stats.average)
                      ? 'fill-[rgb(var(--accent))] text-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--muted))]'
                  )}
                />
              ))}
            </div>
            <div className="text-sm text-[rgb(var(--muted))]">
              {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats.distribution[stars - 1]
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0

              return (
                <div key={stars} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium">{stars}</span>
                    <Star className="h-4 w-4 fill-[rgb(var(--accent))] text-[rgb(var(--accent))]" />
                  </div>
                  <div className="flex-1 h-2 bg-[rgb(var(--surface-muted))] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[rgb(var(--accent))] rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-[rgb(var(--muted))] w-12 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Write Review Button */}
        {userEmail && !isWriting && (
          <div className="mt-6 pt-6 border-t border-[rgb(var(--border))]/20">
            <Button
              onClick={() => setIsWriting(true)}
              className="btn btn-primary w-full md:w-auto"
            >
              Write a Review
            </Button>
          </div>
        )}
      </div>

      {/* Write Review Form */}
      {isWriting && (
        <div className="content-card space-y-4 animate-fade-in">
          <h3 className="text-lg font-semibold">Write Your Review</h3>
          
          {/* Star Rating Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-8 w-8',
                      star <= (hoverRating || rating)
                        ? 'fill-[rgb(var(--accent))] text-[rgb(var(--accent))]'
                        : 'text-[rgb(var(--muted))]'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              maxLength={100}
              className="input-surface"
            />
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Review *</label>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with others..."
              className="textarea-surface min-h-[120px]"
              maxLength={1000}
              rows={6}
            />
            <div className="text-xs text-[rgb(var(--muted))] text-right">
              {reviewText.length} / 1000
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmitReview}
              disabled={loading || rating === 0 || !reviewText.trim()}
              className="btn btn-primary"
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>
            <Button
              onClick={() => {
                setIsWriting(false)
                setRating(0)
                setTitle('')
                setReviewText('')
              }}
              variant="ghost"
              disabled={loading}
              className="btn btn-ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">All Reviews</h3>
        
        {reviews.length === 0 ? (
          <div className="content-card text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[rgb(var(--muted))]" />
            <p className="text-[rgb(var(--muted))]">
              No reviews yet. Be the first to review {placeName}!
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard key={review.id} review={review} userEmail={userEmail} placeName={placeName} />
          ))
        )}
      </div>
    </div>
  )
}

function ReviewCard({ review, userEmail, placeName }: { review: Review; userEmail?: string; placeName: string }) {
  const [helpful, setHelpful] = React.useState<boolean | null>(null)

  const handleVote = async (isHelpful: boolean) => {
    if (!userEmail) {
      toast('Sign in to vote on reviews')
      return
    }

    try {
      await fetch(`/api/reviews/${review.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({ is_helpful: isHelpful }),
      })
      setHelpful(isHelpful)
    } catch (error) {
      toast.error('Failed to submit vote')
    }
  }

  return (
    <div className="content-card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-[rgb(var(--accent))]/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-[rgb(var(--accent))]">
              {review.user_name?.[0] ?? review.user_email[0].toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{review.user_name ?? 'Anonymous'}</span>
              {review.is_verified && (
                <CheckCircle2 className="h-4 w-4 text-[rgb(var(--accent))]" aria-label="Verified visit" />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
              <span>{new Date(review.created_at).toLocaleDateString()}</span>
              {review.visit_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Visited {new Date(review.visit_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'h-4 w-4',
                star <= review.rating
                  ? 'fill-[rgb(var(--accent))] text-[rgb(var(--accent))]'
                  : 'text-[rgb(var(--muted))]'
              )}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <h4 className="font-semibold text-[rgb(var(--text))]">{review.title}</h4>
      )}

      {/* Review Text */}
      <p className="text-sm leading-relaxed text-[rgb(var(--text))]">{review.review_text}</p>

      {/* Helpful Votes */}
      <div className="flex items-center gap-4 pt-2 border-t border-[rgb(var(--border))]/20">
        <span className="text-xs text-[rgb(var(--muted))]">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(true)}
            disabled={helpful !== null}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              helpful === true
                ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))]/30 hover:border-[rgb(var(--border))]/50'
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{review.helpful_count}</span>
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={helpful !== null}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              helpful === false
                ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))]/30 hover:border-[rgb(var(--border))]/50'
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            <span>{review.not_helpful_count}</span>
          </button>
        </div>
      </div>

      {/* Business Response */}
      {review.response_text && (
        <div className="mt-4 rounded-xl bg-[rgb(var(--surface-muted))]/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--accent))]">
              Response from {placeName}
            </span>
            {review.response_date && (
              <span className="text-xs text-[rgb(var(--muted))]">
                {new Date(review.response_date).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{review.response_text}</p>
        </div>
      )}
    </div>
  )
}
