from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly resolve .env relative to THIS file's directory (backend/)
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# We strictly enforce the MongoDB Atlas remote clustering URI.
MONGO_URI = os.getenv("MONGO_URI") or "mongodb+srv://careerforge:careerforge123@cluster0.w6bly7l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
print(f"[Database] MONGO_URI loaded: {'YES' if MONGO_URI else 'NO'}")

client = None
db = None

def get_db():
    global client, db
    if client is None:
        if not MONGO_URI:
            print("[Database] WARNING: No MONGO_URI found in environment variables. MongoDB Atlas is entirely offline.")
            return None
            
        try:
            client = AsyncIOMotorClient(MONGO_URI)
            db = client.careerforge
            print("[Database] MongoDB Atlas client formally connected.")
        except Exception as e:
            print(f"[Database] Failed to initialize MongoDB Atlas: {e}")
            return None
    return db
