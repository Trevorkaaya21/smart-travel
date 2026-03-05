"""
Pydantic schemas for ML service request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Shared ──────────────────────────────────────────────

class PlaceResult(BaseModel):
    id: str
    name: str
    category: str = ""
    rating: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo: Optional[str] = None
    photo_credit: Optional[str] = None
    score: float = 0.0
    distance_km: Optional[float] = None
    reason: Optional[str] = None
    source: str = "ml"


class PlaceInput(BaseModel):
    id: str = ""
    name: str
    category: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None


# ─── Health ──────────────────────────────────────────────

class HealthResponse(BaseModel):
    ok: bool
    models_loaded: bool
    places_indexed: int
    version: str


# ─── Search ──────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    lat: Optional[float] = None
    lng: Optional[float] = None
    limit: int = Field(default=10, ge=1, le=50)
    category: Optional[str] = None
    min_rating: Optional[float] = Field(default=None, ge=0, le=5)


class SearchResponse(BaseModel):
    results: list[PlaceResult]
    count: int
    query: str
    source: str
    latency_ms: float = 0


# ─── Recommendations ────────────────────────────────────

class RecommendRequest(BaseModel):
    user_email: str = Field(..., min_length=3, max_length=200)
    limit: int = Field(default=10, ge=1, le=50)
    strategy: str = Field(default="hybrid", pattern="^(hybrid|content|popular)$")


class RecommendResponse(BaseModel):
    recommendations: list[PlaceResult]
    count: int
    strategy: str
    user_email: str


# ─── Similar Places ─────────────────────────────────────

class SimilarRequest(BaseModel):
    place_id: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=30)


class SimilarResponse(BaseModel):
    results: list[PlaceResult]
    count: int
    source_place_id: str


# ─── Itinerary Optimization ─────────────────────────────

class OptimizeRequest(BaseModel):
    places: list[PlaceInput]
    days: int = Field(default=1, ge=1, le=30)
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    max_places_per_day: int = Field(default=6, ge=1, le=15)


class OptimizedDay(BaseModel):
    day: int
    places: list[dict]
    distance_km: float
    estimated_minutes: float


class OptimizeResponse(BaseModel):
    optimized_days: list[OptimizedDay]
    total_distance_km: float
    estimated_time_minutes: float


# ─── Suggestions ─────────────────────────────────────────

class SuggestRequest(BaseModel):
    partial_query: str = Field(..., min_length=1, max_length=100)
    lat: Optional[float] = None
    lng: Optional[float] = None
    limit: int = Field(default=8, ge=1, le=20)


class SuggestResponse(BaseModel):
    suggestions: list[str]
    count: int


# ─── Trending ───────────────────────────────────────────

class TrendingItem(BaseModel):
    id: str
    name: str
    category: str = ""
    rating: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo: Optional[str] = None
    trend_score: float = 0
    source: str = "ml_trending"


class TrendingResponse(BaseModel):
    trending: list[TrendingItem]
    period_days: int
