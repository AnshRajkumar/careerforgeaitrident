import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY)

def extract_skills(resume_text):
    detected_skills = []
    
    # Simple truncate to avoid massive token costs if resume is huge
    safe_text = resume_text[:4000]

    try:
        prompt = f"Analyze the following resume text. Extract all professional skills (both hard and soft) possessed by the candidate. Return ONLY a raw JSON array of strings, nothing else. Example: [\"Skill 1\", \"Skill 2\"].\n\nResume Text:\n{safe_text}"
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert AI resume parser. Output only valid JSON arrays without markdown formatting."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        
        # Clean potential markdown
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
            
        detected_skills = json.loads(content)
        if not isinstance(detected_skills, list):
            detected_skills = []
            
    except Exception as e:
        print(f"Error extracting skills via AI: {e}")
        # Fallback to basic keyword matching if AI fails (reading from old dataset if possible or just returning empty)
        detected_skills = []

    # Clean and deduplicate
    final_skills = []
    for s in detected_skills:
        if isinstance(s, str) and s.strip() and s.strip() not in final_skills:
            final_skills.append(s.strip())

    return final_skills