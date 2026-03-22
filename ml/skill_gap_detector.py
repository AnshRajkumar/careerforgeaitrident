import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY)

def detect_skill_gap(student_skills, role):
    required_skills = []
    try:
        prompt = f"List exactly 15 of the most important professional skills (both hard and soft) required for the role of '{role}'. Return ONLY a raw JSON array of strings, nothing else. Example: [\"Skill 1\", \"Skill 2\"]."
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert career counselor. Output only valid JSON arrays without markdown formatting."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        # Clean potential markdown
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
            
        required_skills = json.loads(content)
        if not isinstance(required_skills, list):
            required_skills = []
    except Exception as e:
        print(f"Error generating required skills via AI: {e}")
        required_skills = [
            "Communication", "Problem Solving", "Teamwork", "Adaptability", 
            "Project Management", "Data Analysis", "Leadership"
        ]

    missing_skills = []
    student_skills_lower = [s.lower() for s in student_skills]

    for skill in required_skills:
        if skill.lower() not in student_skills_lower:
            missing_skills.append(skill)

    return {
        "role": role,
        "required_skills": required_skills,
        "student_skills": student_skills,
        "missing_skills": missing_skills
    }