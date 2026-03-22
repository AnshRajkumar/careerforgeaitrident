import os
import PyPDF2
from docx import Document

from ml.multi_rag import build_rag_for_type


# ------------------------------
# EXTRACT TEXT FROM FILE
# ------------------------------
def extract_text_from_pdf(file_path):
    text = ""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        elif ext == '.docx':
            doc = Document(file_path)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        else:
            # fallback for txt or other unhandled extensions
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                text = file.read()
    except Exception as e:
        print(f"Extraction Error: {e}")

    return text.strip()


# ------------------------------
# MAIN RESUME PROCESSOR
# ------------------------------
def process_resume(file_path, user_id):
    """
    Full pipeline:
    1. Extract text
    2. Build RAG context
    """
    try:
        resume_text = extract_text_from_pdf(file_path)

        if not resume_text.strip():
            print("⚠️ Empty resume text")
            return ""

        build_rag_for_type(user_id, resume_text, "resume")

        print(f"✅ Resume processed + Context stored for user: {user_id}")

        return resume_text

    except Exception as e:
        print("RESUME PROCESSING ERROR:", e)
        return ""