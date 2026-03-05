"""
Smart Travel ML Service
=======================
Production-grade ML service providing:
- Semantic place search via embeddings
- Personalized recommendations (collaborative + content-based filtering)
- Itinerary optimization (TSP-variant solver)
- Smart suggestions based on user behavior patterns
- Trending destinations detection

Architecture:
- FastAPI for high-performance async HTTP
- sentence-transformers for semantic embeddings
- FAISS for millisecond-level vector search
- scikit-learn for recommendation models
- In-memory caching for sub-10ms responses
"""

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os, time, logging

from .models import PlaceEmbeddingEngine, RecommendationEngine, ItineraryOptimizer, TrendingDetector
from .database import Database
from .schemas import (
    SearchRequest, SearchResponse,
    RecommendRequest, RecommendResponse,
    OptimizeRequest, OptimizeResponse,
    SuggestRequest, SuggestResponse,
    TrendingResponse,
    SimilarRequest, SimilarResponse,
    HealthResponse,
)
from .security import RateLimiter, validate_api_key
from .cache import TTLCache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart-travel-ml")

# Global ML engines (loaded once at startup)
embedding_engine: PlaceEmbeddingEngine | None = None
recommendation_engine: RecommendationEngine | None = None
itinerary_optimizer: ItineraryOptimizer | None = None
trending_detector: TrendingDetector | None = None
db: Database | None = None
cache = TTLCache(max_size=2000, default_ttl=300)
rate_limiter = RateLimiter(max_requests=120, window_seconds=60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup, clean up on shutdown."""
    global embedding_engine, recommendation_engine, itinerary_optimizer, trending_detector, db

    logger.info("Loading ML models...")
    start = time.time()

    db = Database(os.getenv("DATABASE_URL", ""))
    await db.connect()

    embedding_engine = PlaceEmbeddingEngine()
    recommendation_engine = RecommendationEngine()
    itinerary_optimizer = ItineraryOptimizer()
    trending_detector = TrendingDetector()

    # Load places from DB and build index
    places = await db.get_all_places()
    if places:
        embedding_engine.build_index(places)
        recommendation_engine.fit(places)
        trending_detector.update(places)
        logger.info(f"Indexed {len(places)} places in {time.time()-start:.2f}s")
    else:
        logger.warning("No places found in database. Index will be built on first search.")

    logger.info(f"ML models loaded in {time.time()-start:.2f}s")
    yield

    # Cleanup
    if db:
        await db.disconnect()
    logger.info("ML service shut down")


app = FastAPI(
    title="Smart Travel ML",
    version="1.0.0",
    description="ML-powered travel recommendations, search, and optimization",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ─── Health ───────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        ok=True,
        models_loaded=embedding_engine is not None,
        places_indexed=embedding_engine.index_size if embedding_engine else 0,
        version="1.0.0",
    )


# ─── Semantic Search ─────────────────────────────────────

@app.post("/v1/ml/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest, request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    cache_key = f"search:{req.query}:{req.lat}:{req.lng}:{req.limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    if not embedding_engine or embedding_engine.index_size == 0:
        raise HTTPException(503, "Search index not ready. Add places first.")

    results = embedding_engine.search(
        query=req.query,
        lat=req.lat,
        lng=req.lng,
        limit=req.limit,
        category_filter=req.category,
        min_rating=req.min_rating,
    )

    response = SearchResponse(
        results=results,
        count=len(results),
        query=req.query,
        source="ml_embedding",
        latency_ms=0,
    )
    cache.set(cache_key, response, ttl=180)
    return response


# ─── Personalized Recommendations ────────────────────────

@app.post("/v1/ml/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest, request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    if not recommendation_engine or not db:
        raise HTTPException(503, "Recommendation engine not ready")

    cache_key = f"rec:{req.user_email}:{req.limit}:{req.strategy}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Get user's interaction history
    favorites = await db.get_user_favorites(req.user_email)
    trip_places = await db.get_user_trip_places(req.user_email)
    user_history = favorites + trip_places

    recommendations = recommendation_engine.recommend(
        user_history=user_history,
        strategy=req.strategy,
        limit=req.limit,
        exclude_ids=set(p["id"] for p in user_history),
    )

    response = RecommendResponse(
        recommendations=recommendations,
        count=len(recommendations),
        strategy=req.strategy,
        user_email=req.user_email,
    )
    cache.set(cache_key, response, ttl=600)
    return response


# ─── Similar Places ──────────────────────────────────────

@app.post("/v1/ml/similar", response_model=SimilarResponse)
async def find_similar(req: SimilarRequest, request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    if not embedding_engine:
        raise HTTPException(503, "Embedding engine not ready")

    cache_key = f"similar:{req.place_id}:{req.limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    results = embedding_engine.find_similar(
        place_id=req.place_id,
        limit=req.limit,
    )

    response = SimilarResponse(results=results, count=len(results), source_place_id=req.place_id)
    cache.set(cache_key, response, ttl=600)
    return response


# ─── Itinerary Optimization ──────────────────────────────

@app.post("/v1/ml/optimize", response_model=OptimizeResponse)
async def optimize_itinerary(req: OptimizeRequest, request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    if not itinerary_optimizer:
        raise HTTPException(503, "Optimizer not ready")

    result = itinerary_optimizer.optimize(
        places=req.places,
        days=req.days,
        start_lat=req.start_lat,
        start_lng=req.start_lng,
        max_places_per_day=req.max_places_per_day,
    )

    return OptimizeResponse(
        optimized_days=result["days"],
        total_distance_km=result["total_distance_km"],
        estimated_time_minutes=result["estimated_time_minutes"],
    )


# ─── Smart Suggestions ──────────────────────────────────

@app.post("/v1/ml/suggest", response_model=SuggestResponse)
async def smart_suggest(req: SuggestRequest, request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    if not embedding_engine or not db:
        raise HTTPException(503, "Suggestion engine not ready")

    cache_key = f"suggest:{req.partial_query}:{req.lat}:{req.lng}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    suggestions = embedding_engine.suggest(
        partial_query=req.partial_query,
        lat=req.lat,
        lng=req.lng,
        limit=req.limit,
    )

    response = SuggestResponse(suggestions=suggestions, count=len(suggestions))
    cache.set(cache_key, response, ttl=300)
    return response


# ─── Trending Destinations ───────────────────────────────

@app.get("/v1/ml/trending", response_model=TrendingResponse)
async def trending(request: Request):
    rate_limiter.check(request.client.host if request.client else "unknown")

    cached = cache.get("trending")
    if cached:
        return cached

    if not trending_detector or not db:
        raise HTTPException(503, "Trending detector not ready")

    # Get recent activity from DB
    recent = await db.get_recent_activity(days=7)
    results = trending_detector.detect(recent)

    response = TrendingResponse(trending=results, period_days=7)
    cache.set("trending", response, ttl=3600)
    return response


# ─── Rebuild Index (Admin) ───────────────────────────────

@app.post("/v1/ml/reindex")
async def reindex(request: Request):
    """Rebuild the search index from the database."""
    rate_limiter.check(request.client.host if request.client else "unknown")

    if not db or not embedding_engine:
        raise HTTPException(503, "Service not ready")

    places = await db.get_all_places()
    if not places:
        return {"ok": True, "indexed": 0, "message": "No places in database"}

    embedding_engine.build_index(places)
    if recommendation_engine:
        recommendation_engine.fit(places)
    if trending_detector:
        trending_detector.update(places)

    return {"ok": True, "indexed": len(places)}
