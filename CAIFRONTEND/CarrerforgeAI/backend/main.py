from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# Settings
# ─────────────────────────────────────────────
class Settings(BaseSettings):
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DB_NAME: str = "careerforgeai"

settings = Settings()

# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(title="CareerforgeAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production, set to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Database lifecycle
# ─────────────────────────────────────────────
@app.on_event("startup")
async def startup_db():
    app.mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
    app.db = app.mongodb_client[settings.DB_NAME]
    print(f"✅ Connected to MongoDB: {settings.DB_NAME}")

@app.on_event("shutdown")
async def shutdown_db():
    app.mongodb_client.close()

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────
class ReviewIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    message: str = Field(..., min_length=3, max_length=2000)
    rating: Optional[int] = Field(None, ge=1, le=5)

class ReviewOut(ReviewIn):
    id: str
    created_at: datetime
    status: str = "pending"   # pending | reviewed | resolved

class ReleaseNote(BaseModel):
    version: str
    date: str
    changes: list[str]

# ─────────────────────────────────────────────
# Review Endpoints
# ─────────────────────────────────────────────
@app.post("/api/reviews", status_code=status.HTTP_201_CREATED)
async def submit_review(review: ReviewIn):
    """Submit a new user review — stored in MongoDB."""
    doc = review.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["status"] = "pending"

    result = await app.db["reviews"].insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}


@app.get("/api/reviews")
async def get_reviews(skip: int = 0, limit: int = 50):
    """Admin only — fetch all reviews from MongoDB."""
    cursor = app.db["reviews"].find().sort("created_at", -1).skip(skip).limit(limit)
    reviews = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        reviews.append(doc)
    total = await app.db["reviews"].count_documents({})
    return {"total": total, "reviews": reviews}


@app.patch("/api/reviews/{review_id}/status")
async def update_review_status(review_id: str, new_status: str):
    """Admin — update a review's status (pending/reviewed/resolved)."""
    from bson import ObjectId
    if new_status not in ("pending", "reviewed", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status value.")
    result = await app.db["reviews"].update_one(
        {"_id": ObjectId(review_id)},
        {"$set": {"status": new_status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found.")
    return {"success": True}


# ─────────────────────────────────────────────
# Release Notes Endpoints
# ─────────────────────────────────────────────
@app.get("/api/release-notes")
async def get_release_notes():
    """Fetch all release notes, newest first."""
    cursor = app.db["release_notes"].find().sort("date", -1)
    notes = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        notes.append(doc)

    # If DB is empty, return built-in seed data
    if not notes:
        notes = [
            {
                "id": "seed-1",
                "version": "v1.3.0",
                "date": "2026-03-18",
                "changes": [
                    "🛡️ Added Role-Based Authentication (Student, Mentor, College, Admin).",
                    "🤖 Introduced VarGo AI assistant with student-focused avatar.",
                    "🎯 Implemented path-specific tool filtering (Technical vs Non-Technical).",
                    "📰 Made Release Notes dynamic via FastAPI backend.",
                ]
            },
            {
                "id": "seed-2",
                "version": "v1.2.0",
                "date": "2026-03-17",
                "changes": [
                    "✨ Added interactive Sidebar for easier navigation.",
                    "🛠️ Improved 'Start Your Journey' workflow.",
                    "📱 Optimized mobile layout for all tool pages.",
                    "🛡️ Added Terms & Conditions and Help Center.",
                ]
            }
        ]
    return notes


@app.post("/api/release-notes", status_code=status.HTTP_201_CREATED)
async def add_release_note(note: ReleaseNote):
    """Admin — add a new release note entry."""
    result = await app.db["release_notes"].insert_one(note.model_dump())
    return {"success": True, "id": str(result.inserted_id)}


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "CareerforgeAI API is running 🚀"}
