from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from datetime import datetime

MONGO_URI = "mongodb+srv://careerforge:careerforge123@cluster0.w6bly7l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

async def test():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.careerforge
    
    # Test write
    result = await db.vargo_chats.update_one(
        {"session_id": "direct_test_001", "user_id": "user_123"},
        {
            "$push": {
                "messages": {
                    "$each": [
                        {"role": "user", "text": "direct test message", "timestamp": str(datetime.now())},
                        {"role": "vargo", "text": "direct test reply", "timestamp": str(datetime.now())}
                    ]
                }
            },
            "$setOnInsert": {"created_at": str(datetime.now())},
            "$set": {"updated_at": str(datetime.now())}
        },
        upsert=True
    )
    print(f"Write result: matched={result.matched_count}, modified={result.modified_count}, upserted={result.upserted_id}")
    
    # Test read
    cursor = db.vargo_chats.find({"user_id": "user_123"})
    docs = []
    async for doc in cursor:
        docs.append(doc)
    print(f"Total sessions found: {len(docs)}")
    for doc in docs:
        print(f"  Session: {doc.get('session_id')}, Messages: {len(doc.get('messages', []))}")

asyncio.run(test())
