from ml.rag_store import user_rag_store


# ------------------------------
# BUILD RAG FOR TYPE (Direct Text)
# ------------------------------
def build_rag_for_type(user_id, text, rag_type="resume"):
    # Since we are using standard Groq LLMs with large context windows,
    # we don't need FAISS vector embeddings for small documents like resumes.
    # We simply store the raw text directly in the store.
    
    if user_id not in user_rag_store:
        user_rag_store[user_id] = {}

    user_rag_store[user_id][rag_type] = text


# ------------------------------
# GET COMBINED CONTEXT
# ------------------------------
def get_combined_context(user_id, query):

    contexts = []

    if user_id not in user_rag_store:
        return ""

    rag_sources = user_rag_store[user_id]

    for source, text in rag_sources.items():
        try:
            # We pass the full document text directly to the LLM prompt
            tagged = f"[{source.upper()}]\n{text}"
            contexts.append(tagged)

        except Exception as e:
            print("CONTEXT SOURCE ERROR:", e)

    return "\n\n".join(contexts)