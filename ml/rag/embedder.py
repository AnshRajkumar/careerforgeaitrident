from sentence_transformers import SentenceTransformer

# Load model once (important)
model = SentenceTransformer("all-MiniLM-L6-v2")


def get_embeddings(text_chunks):
    """
    Convert text chunks into embeddings
    """
    return model.encode(text_chunks)