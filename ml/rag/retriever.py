from ml.rag.embedder import get_embeddings

class Retriever:
    def __init__(self, vector_store):
        self.vector_store = vector_store

    def retrieve(self, query, k=3):
        query_embedding = get_embeddings([query])[0]
        results = self.vector_store.search(query_embedding, k)
        return results