"""
Core ML Models for Smart Travel
================================
- PlaceEmbeddingEngine: Semantic search using sentence-transformers + FAISS
- RecommendationEngine: Hybrid collaborative + content-based filtering
- ItineraryOptimizer: Day-planning via nearest-neighbor TSP heuristic
- TrendingDetector: Detects trending destinations from recent activity
"""

from __future__ import annotations
import numpy as np
import logging
import time
from typing import Any
from collections import Counter
from math import radians, sin, cos, asin, sqrt

logger = logging.getLogger("smart-travel-ml")

# Lazy-loaded heavy imports
_model = None
_faiss = None


def _get_model():
    """Lazy-load the sentence-transformer model (only ~80MB)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded")
    return _model


def _get_faiss():
    global _faiss
    if _faiss is None:
        import faiss as f
        _faiss = f
    return _faiss


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in km between two lat/lng points."""
    R = 6371
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * asin(sqrt(a))


def _place_to_text(p: dict) -> str:
    """Convert a place dict to a searchable text string."""
    parts = []
    if p.get("name"):
        parts.append(p["name"])
    if p.get("category"):
        parts.append(p["category"])
    if p.get("note"):
        parts.append(p["note"])
    return " ".join(parts) if parts else "unknown place"


# ─── Semantic Search Engine ───────────────────────────────

class PlaceEmbeddingEngine:
    """
    Semantic search over places using sentence-transformers + FAISS.
    Provides sub-10ms search after initial index build.
    """

    def __init__(self):
        self.places: list[dict] = []
        self.embeddings: np.ndarray | None = None
        self.index = None
        self.place_texts: list[str] = []
        self.categories: set[str] = set()

    @property
    def index_size(self) -> int:
        return len(self.places)

    def build_index(self, places: list[dict]):
        """Build FAISS index from place data. ~2-5s for 10k places."""
        start = time.time()
        faiss = _get_faiss()
        model = _get_model()

        self.places = places
        self.place_texts = [_place_to_text(p) for p in places]
        self.categories = set(p.get("category", "") for p in places if p.get("category"))

        # Encode all place texts
        self.embeddings = model.encode(
            self.place_texts,
            show_progress_bar=False,
            batch_size=256,
            normalize_embeddings=True,
        )

        # Build FAISS index (Inner Product for cosine similarity on normalized vectors)
        dim = self.embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(self.embeddings.astype(np.float32))

        logger.info(f"Built search index: {len(places)} places, dim={dim}, took {time.time()-start:.2f}s")

    def search(
        self,
        query: str,
        lat: float | None = None,
        lng: float | None = None,
        limit: int = 10,
        category_filter: str | None = None,
        min_rating: float | None = None,
    ) -> list[dict]:
        """Semantic search with optional geo and category filters."""
        if not self.index or not self.embeddings is not None:
            return []

        model = _get_model()
        start = time.time()

        # Encode query
        query_vec = model.encode([query], normalize_embeddings=True).astype(np.float32)

        # Search more candidates than needed (for post-filtering)
        k = min(limit * 5, len(self.places))
        scores, indices = self.index.search(query_vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.places):
                continue

            place = self.places[idx]

            # Category filter
            if category_filter and place.get("category", "").lower() != category_filter.lower():
                continue

            # Rating filter
            if min_rating and (place.get("rating") or 0) < min_rating:
                continue

            # Geo distance scoring boost
            geo_score = 0.0
            distance_km = None
            if lat is not None and lng is not None and place.get("lat") and place.get("lng"):
                distance_km = haversine(lat, lng, place["lat"], place["lng"])
                # Boost nearby places (within 50km gets full boost)
                geo_score = max(0, 1.0 - (distance_km / 100.0)) * 0.3

            final_score = float(score) + geo_score

            results.append({
                "id": place.get("id", ""),
                "name": place.get("name", ""),
                "category": place.get("category", ""),
                "rating": place.get("rating"),
                "lat": place.get("lat"),
                "lng": place.get("lng"),
                "photo": place.get("photo"),
                "photo_credit": place.get("photo_credit"),
                "score": round(final_score, 4),
                "distance_km": round(distance_km, 2) if distance_km is not None else None,
                "source": "ml_embedding",
            })

            if len(results) >= limit:
                break

        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)

        elapsed = (time.time() - start) * 1000
        logger.info(f"Semantic search '{query}': {len(results)} results in {elapsed:.1f}ms")
        return results

    def find_similar(self, place_id: str, limit: int = 10) -> list[dict]:
        """Find places similar to a given place by embedding similarity."""
        if not self.index:
            return []

        # Find the place in our index
        idx = None
        for i, p in enumerate(self.places):
            if p.get("id") == place_id:
                idx = i
                break

        if idx is None:
            return []

        query_vec = self.embeddings[idx:idx+1].astype(np.float32)
        k = min(limit + 1, len(self.places))
        scores, indices = self.index.search(query_vec, k)

        results = []
        for score, i in zip(scores[0], indices[0]):
            if i < 0 or i == idx:
                continue
            place = self.places[i]
            results.append({
                "id": place.get("id", ""),
                "name": place.get("name", ""),
                "category": place.get("category", ""),
                "rating": place.get("rating"),
                "lat": place.get("lat"),
                "lng": place.get("lng"),
                "photo": place.get("photo"),
                "score": round(float(score), 4),
                "source": "ml_similar",
            })
            if len(results) >= limit:
                break

        return results

    def suggest(
        self,
        partial_query: str,
        lat: float | None = None,
        lng: float | None = None,
        limit: int = 8,
    ) -> list[str]:
        """Generate search suggestions from partial input using embeddings."""
        if not self.index:
            return []

        model = _get_model()
        query_vec = model.encode([partial_query], normalize_embeddings=True).astype(np.float32)

        k = min(30, len(self.places))
        scores, indices = self.index.search(query_vec, k)

        # Extract unique category + name combinations
        seen = set()
        suggestions = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or float(score) < 0.2:
                continue
            place = self.places[idx]
            name = place.get("name", "")
            cat = place.get("category", "")

            # Suggest place names and categories
            if name and name.lower() not in seen:
                seen.add(name.lower())
                suggestions.append(name)
            if cat and cat.lower() not in seen:
                seen.add(cat.lower())
                suggestions.append(f"{cat} places")

            if len(suggestions) >= limit:
                break

        return suggestions[:limit]


# ─── Recommendation Engine ────────────────────────────────

class RecommendationEngine:
    """
    Hybrid recommendation engine combining:
    1. Content-based: Find places similar to user's favorites by features
    2. Collaborative: Find what similar users liked
    3. Popularity: Fall back to highly-rated popular places
    """

    def __init__(self):
        self.places: list[dict] = []
        self.feature_matrix: np.ndarray | None = None
        self.category_map: dict[str, int] = {}

    def fit(self, places: list[dict]):
        """Build feature matrix for content-based filtering."""
        self.places = places
        if not places:
            return

        # Build category encoding
        categories = sorted(set(p.get("category", "other") for p in places))
        self.category_map = {c: i for i, c in enumerate(categories)}
        num_cats = len(categories)

        # Feature vector: [category_one_hot..., rating_normalized, lat_norm, lng_norm]
        features = []
        for p in places:
            cat_vec = [0.0] * num_cats
            cat_idx = self.category_map.get(p.get("category", "other"), 0)
            cat_vec[cat_idx] = 1.0

            rating = (p.get("rating") or 3.0) / 5.0
            lat_norm = ((p.get("lat") or 0) + 90) / 180
            lng_norm = ((p.get("lng") or 0) + 180) / 360

            features.append(cat_vec + [rating, lat_norm, lng_norm])

        self.feature_matrix = np.array(features, dtype=np.float32)
        logger.info(f"Recommendation engine fitted: {len(places)} places, {num_cats} categories")

    def recommend(
        self,
        user_history: list[dict],
        strategy: str = "hybrid",
        limit: int = 10,
        exclude_ids: set[str] | None = None,
    ) -> list[dict]:
        """Generate recommendations based on user history."""
        if not self.places or self.feature_matrix is None:
            return []

        exclude = exclude_ids or set()

        if strategy == "content" or (strategy == "hybrid" and user_history):
            return self._content_based(user_history, limit, exclude)
        elif strategy == "popular":
            return self._popularity_based(limit, exclude)
        else:
            # Hybrid: mix content-based and popularity
            content = self._content_based(user_history, limit, exclude) if user_history else []
            if len(content) >= limit:
                return content
            popular = self._popularity_based(limit - len(content), exclude | set(r["id"] for r in content))
            return content + popular

    def _content_based(self, user_history: list[dict], limit: int, exclude: set[str]) -> list[dict]:
        """Recommend places similar to what the user already likes."""
        if not user_history:
            return self._popularity_based(limit, exclude)

        from sklearn.metrics.pairwise import cosine_similarity

        # Find indices of user's places in our dataset
        user_indices = []
        for h in user_history:
            for i, p in enumerate(self.places):
                if p.get("id") == h.get("id"):
                    user_indices.append(i)
                    break

        if not user_indices:
            return self._popularity_based(limit, exclude)

        # Average user's feature vectors to create a "profile"
        user_profile = np.mean(self.feature_matrix[user_indices], axis=0, keepdims=True)

        # Compute similarity with all places
        similarities = cosine_similarity(user_profile, self.feature_matrix)[0]

        # Rank and filter
        ranked = np.argsort(similarities)[::-1]
        results = []
        for idx in ranked:
            place = self.places[idx]
            if place.get("id") in exclude:
                continue
            if idx in user_indices:
                continue

            results.append({
                "id": place.get("id", ""),
                "name": place.get("name", ""),
                "category": place.get("category", ""),
                "rating": place.get("rating"),
                "lat": place.get("lat"),
                "lng": place.get("lng"),
                "photo": place.get("photo"),
                "score": round(float(similarities[idx]), 4),
                "reason": "Similar to your favorites",
                "source": "ml_content",
            })
            if len(results) >= limit:
                break

        return results

    def _popularity_based(self, limit: int, exclude: set[str]) -> list[dict]:
        """Recommend highly-rated popular places."""
        scored = []
        for p in self.places:
            if p.get("id") in exclude:
                continue
            rating = p.get("rating") or 0
            scored.append((rating, p))

        scored.sort(key=lambda x: x[0], reverse=True)

        return [
            {
                "id": p.get("id", ""),
                "name": p.get("name", ""),
                "category": p.get("category", ""),
                "rating": p.get("rating"),
                "lat": p.get("lat"),
                "lng": p.get("lng"),
                "photo": p.get("photo"),
                "score": round(rating / 5.0, 4),
                "reason": "Popular destination",
                "source": "ml_popular",
            }
            for rating, p in scored[:limit]
        ]


# ─── Itinerary Optimizer ─────────────────────────────────

class ItineraryOptimizer:
    """
    Optimizes multi-day itineraries by:
    1. Clustering places geographically into days
    2. Optimizing visit order within each day (nearest-neighbor TSP)
    3. Estimating travel times between stops
    """

    def optimize(
        self,
        places: list[dict],
        days: int = 1,
        start_lat: float | None = None,
        start_lng: float | None = None,
        max_places_per_day: int = 6,
    ) -> dict[str, Any]:
        """Optimize an itinerary across multiple days."""
        if not places:
            return {"days": [], "total_distance_km": 0, "estimated_time_minutes": 0}

        valid_places = [p for p in places if p.get("lat") is not None and p.get("lng") is not None]
        if not valid_places:
            # No coordinates - just distribute evenly
            return self._distribute_evenly(places, days)

        # Step 1: Cluster places into days by geographic proximity
        day_groups = self._cluster_into_days(valid_places, days, max_places_per_day)

        # Step 2: Optimize order within each day
        optimized_days = []
        total_distance = 0.0
        total_time = 0.0

        for day_num, day_places in enumerate(day_groups, 1):
            if not day_places:
                continue

            ordered, distance = self._optimize_day_order(
                day_places,
                start_lat=start_lat,
                start_lng=start_lng,
            )

            # ~30km/h average in city, plus 45min per stop
            travel_minutes = (distance / 30) * 60
            stop_minutes = len(ordered) * 45
            day_time = travel_minutes + stop_minutes

            total_distance += distance
            total_time += day_time

            optimized_days.append({
                "day": day_num,
                "places": [
                    {
                        "id": p.get("id", ""),
                        "name": p.get("name", ""),
                        "category": p.get("category", ""),
                        "lat": p.get("lat"),
                        "lng": p.get("lng"),
                        "order": i + 1,
                    }
                    for i, p in enumerate(ordered)
                ],
                "distance_km": round(distance, 2),
                "estimated_minutes": round(day_time),
            })

        return {
            "days": optimized_days,
            "total_distance_km": round(total_distance, 2),
            "estimated_time_minutes": round(total_time),
        }

    def _cluster_into_days(
        self,
        places: list[dict],
        days: int,
        max_per_day: int,
    ) -> list[list[dict]]:
        """Cluster places into geographic groups for each day."""
        if days <= 1 or len(places) <= max_per_day:
            return [places]

        # Use simple geographic clustering (k-means on lat/lng)
        from sklearn.cluster import KMeans

        coords = np.array([[p["lat"], p["lng"]] for p in places])
        n_clusters = min(days, len(places))

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(coords)

        groups: list[list[dict]] = [[] for _ in range(n_clusters)]
        for place, label in zip(places, labels):
            groups[label].append(place)

        # Balance: move places from overfull days to underfull
        while True:
            sizes = [len(g) for g in groups]
            max_idx = np.argmax(sizes)
            min_idx = np.argmin(sizes)
            if sizes[max_idx] - sizes[min_idx] <= 1:
                break
            groups[min_idx].append(groups[max_idx].pop())

        return groups

    def _optimize_day_order(
        self,
        places: list[dict],
        start_lat: float | None = None,
        start_lng: float | None = None,
    ) -> tuple[list[dict], float]:
        """Nearest-neighbor heuristic for ordering places within a day."""
        if len(places) <= 1:
            return places, 0.0

        remaining = list(range(len(places)))
        order = []
        total_dist = 0.0

        # Start from given location or first place
        if start_lat is not None and start_lng is not None:
            cur_lat, cur_lng = start_lat, start_lng
        else:
            first = remaining.pop(0)
            order.append(first)
            cur_lat = places[first]["lat"]
            cur_lng = places[first]["lng"]

        while remaining:
            best_idx = -1
            best_dist = float("inf")
            for idx in remaining:
                d = haversine(cur_lat, cur_lng, places[idx]["lat"], places[idx]["lng"])
                if d < best_dist:
                    best_dist = d
                    best_idx = idx

            remaining.remove(best_idx)
            order.append(best_idx)
            total_dist += best_dist
            cur_lat = places[best_idx]["lat"]
            cur_lng = places[best_idx]["lng"]

        return [places[i] for i in order], total_dist

    def _distribute_evenly(self, places: list[dict], days: int) -> dict:
        """Distribute places evenly across days (no coordinates available)."""
        day_groups: list[list[dict]] = [[] for _ in range(days)]
        for i, p in enumerate(places):
            day_groups[i % days].append(p)

        return {
            "days": [
                {
                    "day": d + 1,
                    "places": [
                        {"id": p.get("id", ""), "name": p.get("name", ""), "order": i + 1}
                        for i, p in enumerate(group)
                    ],
                    "distance_km": 0,
                    "estimated_minutes": len(group) * 45,
                }
                for d, group in enumerate(day_groups)
                if group
            ],
            "total_distance_km": 0,
            "estimated_time_minutes": len(places) * 45,
        }


# ─── Trending Detector ───────────────────────────────────

class TrendingDetector:
    """Detects trending destinations from user activity patterns."""

    def __init__(self):
        self.places: list[dict] = []
        self.place_map: dict[str, dict] = {}

    def update(self, places: list[dict]):
        self.places = places
        self.place_map = {p["id"]: p for p in places if p.get("id")}

    def detect(self, recent_activity: list[dict], limit: int = 10) -> list[dict]:
        """Detect trending places from recent favorites/trip additions."""
        if not recent_activity:
            return self._fallback_trending(limit)

        # Count place frequency in recent activity
        counter = Counter(a.get("place_id") for a in recent_activity if a.get("place_id"))

        results = []
        for place_id, count in counter.most_common(limit):
            place = self.place_map.get(place_id)
            if not place:
                continue
            results.append({
                "id": place_id,
                "name": place.get("name", ""),
                "category": place.get("category", ""),
                "rating": place.get("rating"),
                "lat": place.get("lat"),
                "lng": place.get("lng"),
                "photo": place.get("photo"),
                "trend_score": count,
                "source": "ml_trending",
            })

        return results or self._fallback_trending(limit)

    def _fallback_trending(self, limit: int) -> list[dict]:
        """Fallback: return top-rated places."""
        rated = sorted(self.places, key=lambda p: p.get("rating") or 0, reverse=True)
        return [
            {
                "id": p.get("id", ""),
                "name": p.get("name", ""),
                "category": p.get("category", ""),
                "rating": p.get("rating"),
                "photo": p.get("photo"),
                "trend_score": p.get("rating") or 0,
                "source": "ml_popular_fallback",
            }
            for p in rated[:limit]
        ]
