import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY)

def generate_soft_skills_quiz(role):
    """
    Generates 5 highly robust, scenario-based multiple-choice questions 
    tailored to evaluate soft skills for the provided role.
    Categories: Communication, Leadership, Teamwork, Problem Solving, Time Management.
    """
    prompt = f"""You are an expert HR organizational psychologist.
Generate a 5-question multiple-choice soft skills behavioral situational judgment test for the role: "{role}".
The 5 questions MUST assess exactly these 5 categories (one each):
1) Communication
2) Leadership 
3) Teamwork
4) Problem Solving
5) Time Management

Rules:
- Make the scenarios highly realistic, complex, and professional.
- Provide 4 options for each question (labeled A, B, C, D).
- ONLY 1 option is the objectively 'best' professional response (score 5).
- The others should be graded (e.g. 1, 2, 3) based on how decent the response is.

Return your response ONLY as a raw JSON array of 5 objects matching this schema exactly:
[
  {{
    "id": 1,
    "category": "Communication",
    "scenario": "You are leading a project and a key stakeholder disagrees...",
    "options": [
      {{"text": "Option 1 text", "points": 5}},
      {{"text": "Option 2 text", "points": 3}},
      {{"text": "Option 3 text", "points": 1}},
      {{"text": "Option 4 text", "points": 2}}
    ]
  }}
]

Output ONLY the raw JSON array. Do not wrap in ```json markers. Do not provide explanations.
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an AI generating structured JSON for a soft-skills assessment system."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()

        quiz_data = json.loads(content)
        return quiz_data
    except Exception as e:
        print(f"[Soft Skills Gen Error] {e}")
        # Return fallback high-quality static questions if AI fails
        return [
            {
                "id": 1, "category": "Communication",
                "scenario": "A stakeholder disagrees with your timeline. What do you do?",
                "options": [
                    {"text": "Listen to their concerns, present data, and negotiate a compromise.", "points": 5},
                    {"text": "Tell them the timeline is fixed and cannot change.", "points": 1},
                    {"text": "Agree to their timeline but secretly work overtime.", "points": 2},
                    {"text": "Ask your manager to handle the conversation.", "points": 3}
                ]
            },
            {
                "id": 2, "category": "Leadership",
                "scenario": "Your team is demotivated after a major project failure.",
                "options": [
                    {"text": "Host a blameless post-mortem to learn from mistakes and reset vision.", "points": 5},
                    {"text": "Ignore the failure and immediately start the next project.", "points": 1},
                    {"text": "Find out whose fault it was and formally reprimand them.", "points": 2},
                    {"text": "Give everyone a day off to recover.", "points": 3}
                ]
            },
            {
                "id": 3, "category": "Teamwork",
                "scenario": "A colleague is consistently delivering work late, affecting you.",
                "options": [
                    {"text": "Have a private, empathetic 1-on-1 to see if they need help or blockers removed.", "points": 5},
                    {"text": "Complain to your manager immediately.", "points": 2},
                    {"text": "Do their work for them to keep the project on track.", "points": 1},
                    {"text": "Publicly call them out in the next standup meeting.", "points": 1}
                ]
            },
            {
                "id": 4, "category": "Problem Solving",
                "scenario": "You discover a critical bug right before a major product launch.",
                "options": [
                    {"text": "Assess the impact, inform stakeholders, and propose a hotfix timeline.", "points": 5},
                    {"text": "Delay the launch indefinitely without telling anyone.", "points": 1},
                    {"text": "Launch anyway and hope nobody notices.", "points": 1},
                    {"text": "Try to fix it quickly yourself without documenting it.", "points": 2}
                ]
            },
            {
                "id": 5, "category": "Time Management",
                "scenario": "You have three high-priority tasks due today but only time for two.",
                "options": [
                    {"text": "Communicate with stakeholders to reprioritize based on business impact.", "points": 5},
                    {"text": "Work late into the night to finish all three.", "points": 3},
                    {"text": "Do all three poorly to meet the deadline.", "points": 1},
                    {"text": "Just pick the easiest two and ignore the third.", "points": 2}
                ]
            }
        ]

def evaluate_soft_skills(answers_data):
    """
    Evaluates the user's responses. 
    answers_data is expected to be a list of dicts: [{"category": "Communication", "points": 5}, ...]
    The AI generates personalized improvement tips based on the weakest categories.
    """
    try:
        prompt = f"""You are an expert Career Coach.
A user just took a Soft Skills assessment and scored the following points out of 5 per category:
{json.dumps(answers_data, indent=2)}

Please return a detailed JSON evaluation report matching this schema:
{{
  "overall_feedback": "A 2-sentence encouraging summary of their soft skills profile.",
  "strengths": ["Category 1", "Category 2"],
  "weaknesses": ["Category A"],
  "actionable_tips": [
    {{"category": "Category A", "tip": "Specifically how to improve this..."}}
  ]
}}

Output ONLY the raw JSON object. Do not wrap in ```json markers. Do not provide explanations.
"""
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an AI generating structured JSON for a soft-skills assessment system."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()

        report = json.loads(content)
        return report
    except Exception as e:
        print(f"[Soft Skills Eval Error] {e}")
        return {
            "overall_feedback": "You have a solid foundation of soft skills, though there's always room for growth.",
            "strengths": ["Various"],
            "weaknesses": ["Ongoing Practice"],
            "actionable_tips": [
                {"category": "General", "tip": "Continue prioritizing clear communication and empathy in the workplace."}
            ]
        }
