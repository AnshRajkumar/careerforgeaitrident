import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    
    # Check careerforge DB (used by ML backend)
    db1 = client.careerforge
    collections1 = await db1.list_collection_names()
    print("Collections in careerforge:", collections1)
    
    for coll in collections1:
        count = await db1[coll].count_documents({})
        print(f"  - {coll}: {count} documents")
        if count > 0:
            async for doc in db1[coll].find().limit(5):
                print(f"    {doc}")

    # Check careerforgeai DB (used by CRUD backend)
    db2 = client.careerforgeai
    collections2 = await db2.list_collection_names()
    print("\nCollections in careerforgeai:", collections2)
    
    for coll in collections2:
        count = await db2[coll].count_documents({})
        print(f"  - {coll}: {count} documents")
        if count > 0:
            async for doc in db2[coll].find().limit(5):
                print(f"    {doc}")

asyncio.run(main())
