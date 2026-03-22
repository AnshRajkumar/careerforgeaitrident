from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import shutil
import os
import sys

# Ensure project root is on sys.path so ml.* and backend.* imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Also add backend dir so "database" can be imported directly
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ML Modules
from ml.resume_parser import extract_text_from_pdf
from ml.skill_extractor import extract_skills
from ml.skill_gap_detector import detect_skill_gap
from ml.recomender import recommend_courses
from ml.readiness_score import calculate_readiness_score
from ml.vargo_assistant import generate_response
from ml.user_context import update_user_profile
from ml.interview_engine import generate_question, evaluate_answer, generate_followup
from ml.multi_rag import build_rag_for_type

import uvicorn
import pandas as pd
from contextlib import asynccontextmanager
from database import get_db
from datetime import datetime
import json

USER_ID = "default_user"

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    try:
        import jobspy
        import pandas
    except ImportError:
        import subprocess
        import sys
        print(f"[CareerForgeAI] Auto-installing missing JobSpy natively into: {sys.executable}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "python-jobspy", "pandas"])

import os as _cors_os
# In development, fallback to explicit localhost origins to allow credentials
_allowed_origins = _cors_os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TEMP USER (replace later with auth)
USER_ID = "user_123"


# ------------------------------
# Home
# ------------------------------
@app.get("/")
def home():
    return {"message": "CareerForge AI running"}


# ------------------------------
# Google Auth Verification
# ------------------------------
@app.post("/auth/google")
def verify_google_token(token_data: dict):
    # This endpoint verifies the ID token sent from the frontend Google Sign-In
    import requests
    
    try:
        token = token_data.get("token")
        if not token:
            return {"error": "Token is missing"}

        # Verify token using Google's public endpoint instead of google-auth to avoid cross-drive venv import issues
        response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
        
        if response.status_code != 200:
            print(f"Token verification failed: {response.text}")
            return {"error": "Invalid token"}

        idinfo = response.json()
        
        return {
            "status": "success",
            "user": {
                "uid": idinfo.get("sub"),
                "email": idinfo.get("email"),
                "name": idinfo.get("name", ""),
                "picture": idinfo.get("picture", "")
            }
        }
    except Exception as e:
        print(f"Token verification failed: {e}")
        return {"error": "Internal verification error"}


# ------------------------------
# V16: User Progress Dashboard Endpoints
# ------------------------------

@app.post("/api/user/activity")
async def log_activity(activity: dict):
    """Log any user activity (VarGo chat, interview, resume upload, etc.) with timestamp."""
    database = get_db()
    if database is None:
        return {"success": False}
    try:
        uid = activity.get("uid", USER_ID)
        await database.user_activity.insert_one({
            "user_id": uid,
            "type": activity.get("type"),          # e.g. 'vargo_chat', 'resume_upload', 'interview'
            "title": activity.get("title"),         # e.g. 'Asked VarGo about ML'
            "detail": activity.get("detail", ""),   # extra info
            "timestamp": str(datetime.now()),
            "date": datetime.now().strftime("%Y-%m-%d")
        })
        return {"success": True}
    except Exception as e:
        print(f"[MongoDB] Activity log error: {e}")
        return {"success": False}


@app.get("/api/user/progress/{uid}")
async def get_user_progress(uid: str):
    """Return the full progress profile + activity feed for a given Google UID."""
    database = get_db()
    if database is None:
        return {"profile": {}, "activity": [], "stats": {}}
    try:
        # Get user profile
        profile = await database.users.find_one({"user_id": uid}, {"_id": 0}) or {}

        # Get activity feed (latest 50)
        cursor = database.user_activity.find(
            {"user_id": uid},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50)
        activity = []
        async for doc in cursor:
            activity.append(doc)

        # Compute stats
        all_types = [a["type"] for a in activity]
        stats = {
            "total_activities": len(activity),
            "vargo_chats": all_types.count("vargo_chat"),
            "resume_uploads": all_types.count("resume_upload"),
            "interviews": all_types.count("interview"),
            "skill_checks": all_types.count("skill_check"),
            "mentor_chats": all_types.count("mentor_chat"),
        }

        return {"profile": profile, "activity": activity, "stats": stats}
    except Exception as e:
        print(f"[MongoDB] Progress load error: {e}")
        return {"profile": {}, "activity": [], "stats": {}}


# ------------------------------
# V16: Career RPG (System V4) Persistence
# ------------------------------

@app.post("/api/rpg/save")
async def save_rpg_state(payload: dict):
    """Save the entire Career RPG game state to MongoDB, keyed by Google UID."""
    database = get_db()
    if database is None:
        return {"success": False, "error": "Database offline"}
    try:
        uid = payload.get("uid", USER_ID)
        state = payload.get("state", {})
        quests = payload.get("quests", [])
        await database.rpg_saves.update_one(
            {"user_id": uid},
            {
                "$set": {
                    "state": state,
                    "quests": quests,
                    "updated_at": str(datetime.now())
                },
                "$setOnInsert": {"created_at": str(datetime.now())}
            },
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        print(f"[MongoDB] RPG save error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/rpg/load/{uid}")
async def load_rpg_state(uid: str):
    """Load the saved Career RPG game state from MongoDB."""
    database = get_db()
    if database is None:
        return {"state": None, "quests": []}
    try:
        doc = await database.rpg_saves.find_one({"user_id": uid}, {"_id": 0})
        if doc:
            return {"state": doc.get("state"), "quests": doc.get("quests", [])}
        return {"state": None, "quests": []}
    except Exception as e:
        print(f"[MongoDB] RPG load error: {e}")
        return {"state": None, "quests": []}


@app.post("/analyze_resume")
async def analyze_resume(file: UploadFile = File(...)):

    file_location = f"temp_{file.filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    resume_text = extract_text_from_pdf(file_location)

    # 🔥 BUILD RAG (IMPORTANT)
    build_rag_for_type(USER_ID, resume_text, "resume")

    skills = extract_skills(resume_text)

    return {
        "detected_skills": skills
    }


# ------------------------------
# Career Analysis
# ------------------------------
@app.post("/career_analysis")
async def career_analysis(file: UploadFile = File(...), role: str = "machine_learning_engineer"):
    print(f"👉 Received request for role: {role} with file {file.filename}")
    file_location = f"temp_{file.filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print("👉 File saved, starting extraction...")
    resume_text = extract_text_from_pdf(file_location)
    print(f"👉 Extraction finished! Text len: {len(resume_text)}")

    # 🔥 BUILD RAG HERE ALSO
    print("👉 Starting RAG build...")
    build_rag_for_type(USER_ID, resume_text, "resume")
    print("👉 RAG build finished!")

    skills = extract_skills(resume_text)
    print(f"👉 Extracted skills: {skills}")

    analysis = detect_skill_gap(skills, role)
    print("👉 Skill gap detected!")
    recommendations = recommend_courses(analysis["missing_skills"])
    print("👉 Courses recommended!")

    score = calculate_readiness_score(
        skills,
        analysis["missing_skills"]
    )

    update_user_profile(
        skills,
        analysis["missing_skills"],
        role
    )

    print("👉 All done, returning response.")
    return {
        "career_role": role,
        "detected_skills": skills,
        "missing_skills": analysis["missing_skills"],
        "learning_path": recommendations,
        "readiness_score": score
    }

# ------------------------------
# Start Guidance (VarGo Integration)
# ------------------------------
@app.post("/start_guidance")
async def start_guidance(role: str = Form(...), file: UploadFile = File(None)):
    if file:
        file_location = f"temp_guidance_{file.filename}"
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        resume_text = extract_text_from_pdf(file_location)
        build_rag_for_type(USER_ID, resume_text, "resume")
        
        skills = extract_skills(resume_text)
        analysis = detect_skill_gap(skills, role)
        update_user_profile(skills, analysis["missing_skills"], role)
    else:
        # If no resume provided, just feed the role intent to RAG
        update_user_profile([], [], role)
        build_rag_for_type(USER_ID, f"The user is aiming for the career role: {role}.", "job")
        
    return {"status": "success", "role": role}

class CareerRoadmapRequest(BaseModel):
    career: str
    skills: str
    type: str

@app.post("/career_roadmap")
def career_roadmap(request: CareerRoadmapRequest):
    # This matches what CAIFRONTEND career.js sends
    skills_list = [s.strip() for s in request.skills.split(",")]
    
    analysis = detect_skill_gap(skills_list, request.career)
    recommendations = recommend_courses(analysis["missing_skills"])
    
    # We map recommendations back to the 4 steps layout expected by frontend
    roadmap_steps = [
        {"title": "Foundational Skills to Learn", "description": ", ".join(analysis["missing_skills"])},
        {"title": "Recommended Courses", "description": recommendations[:150] + "..."},
        {"title": "Skill Application", "description": f"Build projects targeting {request.career}."},
        {"title": "Interview Ready", "description": f"Practice mock interviews for a {request.career} role."}
    ]
    
    return {"roadmap": roadmap_steps}


# ------------------------------
# VarGo Chat (V15 – Atlas Persistent)
# ------------------------------
class ChatRequest(BaseModel):
    query: str
    session_id: str = None


@app.post("/vargo_chat")
async def vargo_chat(request: ChatRequest):
    response = generate_response(request.query, USER_ID)
    
    # Persist to MongoDB Atlas
    database = get_db()
    if database is not None:
        session_id = request.session_id or "default"
        try:
            await database.vargo_chats.update_one(
                {"session_id": session_id, "user_id": USER_ID},
                {
                    "$push": {
                        "messages": {
                            "$each": [
                                {"role": "user", "text": request.query, "timestamp": str(datetime.now())},
                                {"role": "vargo", "text": response, "timestamp": str(datetime.now())}
                            ]
                        }
                    },
                    "$setOnInsert": {"created_at": str(datetime.now())},
                    "$set": {"updated_at": str(datetime.now())}
                },
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB] Chat save error: {e}")

    return {
        "assistant": "VarGo",
        "response": response
    }


@app.get("/api/vargo/sessions")
async def get_vargo_sessions():
    """Return a list of all previous VarGo chat sessions for the user."""
    database = get_db()
    if database is None:
        return []
    try:
        cursor = database.vargo_chats.find(
            {"user_id": USER_ID},
            {"session_id": 1, "created_at": 1, "updated_at": 1, "messages": {"$slice": 1}, "_id": 0}
        ).sort("updated_at", -1)
        sessions = []
        async for doc in cursor:
            first_msg = doc.get("messages", [{}])[0].get("text", "New Chat") if doc.get("messages") else "New Chat"
            sessions.append({
                "session_id": doc.get("session_id"),
                "preview": first_msg[:60],
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at")
            })
        return sessions
    except Exception as e:
        print(f"[MongoDB] Session list error: {e}")
        return []


@app.get("/api/vargo/session/{session_id}")
async def get_vargo_session(session_id: str):
    """Return the full message history for a specific chat session."""
    database = get_db()
    if database is None:
        return {"messages": []}
    try:
        doc = await database.vargo_chats.find_one(
            {"session_id": session_id, "user_id": USER_ID},
            {"messages": 1, "_id": 0}
        )
        return {"messages": doc.get("messages", []) if doc else []}
    except Exception as e:
        print(f"[MongoDB] Session load error: {e}")
        return {"messages": []}


# ------------------------------
# User Data Persistence (V15)
# ------------------------------
class UserProfile(BaseModel):
    name: str = None
    email: str = None
    role: str = None
    skills: list = []
    avatar: str = None


@app.post("/api/user/save")
async def save_user(profile: UserProfile):
    database = get_db()
    if database is None:
        return {"success": False, "error": "Database offline"}
    try:
        await database.users.update_one(
            {"user_id": USER_ID},
            {
                "$set": {
                    "name": profile.name,
                    "email": profile.email,
                    "role": profile.role,
                    "skills": profile.skills,
                    "avatar": profile.avatar,
                    "updated_at": str(datetime.now())
                },
                "$setOnInsert": {"created_at": str(datetime.now())}
            },
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        print(f"[MongoDB] User save error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/user/profile")
async def get_user_profile():
    database = get_db()
    if database is None:
        return {}
    try:
        doc = await database.users.find_one({"user_id": USER_ID}, {"_id": 0})
        return doc or {}
    except Exception as e:
        print(f"[MongoDB] User load error: {e}")
        return {}


# ------------------------------
# Career Explorer AI Generator
# ------------------------------
@app.get("/api/career/explore")
def explore_careers():
    from ml.vargo_assistant import groq_client
    import json
    
    prompt = """You are an expert labor market analyst.
Generate a JSON array of 6 currently high-demand NON-TECHNICAL career roles (e.g. Marketing, HR, Finance, PM).
For each role, provide EXACTLY these fields:
- "icon": A single relevant emoji (e.g., "📈")
- "title": The job title
- "description": A 2-sentence description of what they do
- "salary": E.g., "₹8L - ₹25L/yr" (make it realistic for India)
- "growth": An integer representing projected growth percentage (e.g., 85)
- "skills": An array of exactly 5 strings denoting core skills

Output ONLY the raw JSON array of 6 objects. Do not use markdown wrappers.
"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a specialized AI generating raw JSON data payloads."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        
        careers_data = json.loads(content)
        return {"careers": careers_data}
    except Exception as e:
        print(f"[Career Explore Error] {e}")
        # Fallback to static
        return {"careers": [
            {"icon": "📦", "title": "Product Manager", "description": "Define product strategy...", "salary": "₹12L – ₹35L/yr", "growth": 92, "skills": ["Strategy", "Agile", "Analytics"]},
            {"icon": "📊", "title": "Business Analyst", "description": "Bridging business needs...", "salary": "₹8L – ₹26L/yr", "growth": 82, "skills": ["SQL", "Stakeholder Mgmt"]}
        ]}

# ------------------------------
# Expert Chat (Non-Tech Career Advisor)
# ------------------------------
@app.post("/expert_chat")
def expert_chat(request: ChatRequest):
    from ml.vargo_assistant import groq_response

    expert_prompt = f"""
You are an expert AI Career Counselor specializing in NON-TECHNICAL careers.
Your areas of expertise include: Product Management, UX/UI Design, Digital Marketing,
Human Resources, Financial Analysis, Content Strategy, Business Analysis, and Project Management.

Instructions:
- Give detailed, actionable career advice
- Include specific salary ranges (in INR), required skills, and growth paths
- Be encouraging but realistic
- Suggest concrete next steps the student can take today
- If asked about technical roles, gently redirect to non-tech alternatives

User Question:
{request.query}
"""

    try:
        response = groq_response(expert_prompt)
    except Exception as e:
        print("Expert Chat Error:", e)
        response = "The expert advisor is temporarily unavailable. Please try again."

    return {
        "assistant": "Career Expert",
        "response": response
    }


# ------------------------------
# Soft Skills AI Module
# ------------------------------
class SoftSkillsRequest(BaseModel):
    role: str

class SoftSkillsEvaluateRequest(BaseModel):
    answers: list

@app.post("/api/soft-skills/generate")
def generate_soft_skills(req: SoftSkillsRequest):
    from ml.soft_skills_engine import generate_soft_skills_quiz
    quiz = generate_soft_skills_quiz(req.role)
    return {"quiz": quiz}

@app.post("/api/soft-skills/evaluate")
def evaluate_soft_skills_endpoint(req: SoftSkillsEvaluateRequest):
    from ml.soft_skills_engine import evaluate_soft_skills
    report = evaluate_soft_skills(req.answers)
    return report


# ------------------------------
# Interview Chat
# ------------------------------
class InterviewStartRequest(BaseModel):
    role: str
    experience: str
    stack: str
    company: str

class InterviewChatRequest(BaseModel):
    message: str


interview_state = {
    "current_question": None,
    "round": 0,
    "role": "Software Engineer",
    "experience": "Mid Level",
    "stack": "General",
    "company": "Unknown"
}

@app.post("/interview_start")
def interview_start(request: InterviewStartRequest):
    global interview_state
    interview_state["current_question"] = None
    interview_state["round"] = 0
    interview_state["role"] = request.role
    interview_state["experience"] = request.experience
    interview_state["stack"] = request.stack
    interview_state["company"] = request.company
    return {"status": "success", "message": f"VarGo Pro-Proctor Initialization Complete.\nCompany: {request.company}\nRole: {request.role}\nLevel: {request.experience}\nStack: {request.stack}\n\nPlease type 'ready' to receive your Round 1 (DSA) question."}


@app.post("/interview_chat")
def interview_chat(request: InterviewChatRequest):

    user_input = request.message

    if interview_state["current_question"] is None:

        interview_state["round"] = 1
        q_data = generate_question(interview_state)

        # q_data is now a dict: {"round_name": ..., "question": ..., "time_limit_minutes": ...}
        if isinstance(q_data, str):
            # Fallback if parsing failed
            q_text = q_data
            round_name = "Round 1"
            time_limit = 5
        else:
            q_text = q_data.get("question", "System Error")
            round_name = q_data.get("round_name", "Round 1")
            time_limit = q_data.get("time_limit_minutes", 5)

        interview_state["current_question"] = q_text

        return {
            "role": "VarGo",
            "message": f"🎤 Interview Started: {interview_state['company']}\n\n{round_name}:\n{q_text}",
            "time_limit": time_limit
        }

    evaluation = evaluate_answer(
        interview_state["current_question"],
        user_input
    )

    if interview_state["round"] >= 3:
        interview_state["current_question"] = None
        return {
            "role": "VarGo",
            "message": f"📝 Final Evaluation for Round 3:\n\n{evaluation}\n\n--- INTERVIEW COMPLETE ---",
            "time_limit": 0
        }

    interview_state["round"] += 1
    next_q_data = generate_question(interview_state)
    
    if isinstance(next_q_data, str):
        next_q_text = next_q_data
        next_round_name = f"Round {interview_state['round']}"
        next_time_limit = 5
    else:
        next_q_text = next_q_data.get("question", "System Error")
        next_round_name = next_q_data.get("round_name", f"Round {interview_state['round']}")
        next_time_limit = next_q_data.get("time_limit_minutes", 5)
        
    interview_state["current_question"] = next_q_text

    return {
        "role": "VarGo",
        "message": f"📊 Evaluation for Round {interview_state['round']-1}:\n{evaluation}\n\n---\n\n➡️ {next_round_name}:\n{next_q_text}",
        "time_limit": next_time_limit
    }


# ------------------------------
# Upload Job (Multi-RAG)
# ------------------------------
@app.post("/upload-job")
def upload_job(desc: str):

    build_rag_for_type(USER_ID, desc, "job")

    return {"message": "Job context added"}


# ------------------------------
# Upload Course (Multi-RAG)
# ------------------------------
@app.post("/upload-course")
def upload_course(content: str):

    build_rag_for_type(USER_ID, content, "course")

    return {"message": "Course context added"}


# ------------------------------
# Mentor Test Generation (AI)
# ------------------------------
class MentorTestRequest(BaseModel):
    expertise: str
    num_questions: int = 20

@app.post("/mentor_generate_test")
def mentor_generate_test(request: MentorTestRequest):
    from ml.vargo_assistant import groq_response
    import json as json_lib

    prompt = f"""Generate exactly {request.num_questions} multiple-choice questions to test an expert mentor in "{request.expertise}".

Each question must have exactly 4 options (A, B, C, D) and one correct answer.

Return ONLY a valid JSON array, no extra text. Each element must have:
- "id": question number (1-{request.num_questions})
- "question": the question text
- "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}
- "correct": the correct option letter ("A", "B", "C", or "D")

The questions should be advanced-level, covering deep concepts, best practices, edge cases, and real-world scenarios in {request.expertise}. Make them genuinely challenging for an expert.

Return ONLY the JSON array, nothing else."""

    try:
        raw = groq_response(prompt)
        # Extract JSON from the response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return {"error": "AI failed to generate valid questions. Please try again."}
        
        questions = json_lib.loads(raw[start:end])
        return {"questions": questions}
    except Exception as e:
        print(f"Mentor test generation error: {e}")
        return {"error": "Failed to generate test. Please try again."}

# ------------------------------
# College Student Test Generation (AI)
# ------------------------------
class CollegeTestRequest(BaseModel):
    topic: str
    num_questions: int = 10
    studentId: str = None
    college: str = None

@app.post("/college_generate_test")
async def college_generate_test(request: CollegeTestRequest):
    from ml.vargo_assistant import groq_response
    import json as json_lib

    prompt = f"""Generate exactly {request.num_questions} multiple-choice questions to test a student's knowledge in "{request.topic}".

Each question must have exactly 4 options (A, B, C, D) and one correct answer.

Return ONLY a valid JSON array, no extra text. Each element must have:
- "id": question number (1-{request.num_questions})
- "question": the question text
- "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}
- "correct": the correct option letter ("A", "B", "C", or "D")

The questions should be appropriate for an intermediate student, covering core concepts, applied scenarios, and theory in {request.topic}.

Return ONLY the JSON array, nothing else."""

    try:
        raw = groq_response(prompt)
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return {"error": "AI failed to generate valid questions. Please try again."}
        
        questions = json_lib.loads(raw[start:end])
        
        # Try to save to MongoDB Backend
        db = get_db()
        if db is not None and request.studentId and request.college:
            await db.tests.insert_one({
                "studentId": request.studentId,
                "college": request.college,
                "topic": request.topic,
                "numQuestions": request.num_questions,
                "questions": questions,
                "status": "pending",
                "assignedAt": datetime.utcnow()
            })
            return {"message": "Test generated and saved by backend."}
        
        # Fallback to returning raw questions if MongoDB isn't set up yet
        return {"questions": questions}
        
    except Exception as e:
        print(f"College test generation error: {e}")
        return {"error": "Failed to generate test. Please try again."}


# ------------------------------
# Mentor Test Evaluation
# ------------------------------
class MentorTestSubmission(BaseModel):
    questions: list
    answers: dict  # {"1": "A", "2": "C", ...}

@app.post("/mentor_evaluate_test")
def mentor_evaluate_test(submission: MentorTestSubmission):
    correct_count = 0
    total = len(submission.questions)
    details = []

    for q in submission.questions:
        qid = str(q["id"])
        user_answer = submission.answers.get(qid, "")
        correct_answer = q["correct"]
        is_correct = user_answer.upper() == correct_answer.upper()

        if is_correct:
            correct_count += 1

        details.append({
            "id": q["id"],
            "question": q["question"],
            "your_answer": user_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct
        })

    percentage = round((correct_count / total) * 100, 1) if total > 0 else 0
    passed = percentage >= 95

    return {
        "score": correct_count,
        "total": total,
        "percentage": percentage,
        "passed": passed,
        "details": details
    }


# ------------------------------
# Mentor & Student Chat System (In-Memory DB)
# ------------------------------
# Format: { "chat_id": { "id": str, "studentId": str, "studentUsername": str, "mentorId": str, "messages": list } }
chats_db = {}

@app.get("/api/mentors")
def get_available_mentors():
    # Return a demo list of available mentors for students to chat with
    return {
        "mentors": [
            {
                "id": "mentor_alex",
                "name": "Alex Chen",
                "expertise": "Machine Learning & AI",
                "experience": 8
            },
            {
                "id": "mentor_sarah",
                "name": "Sarah Johnson",
                "expertise": "Frontend Architecture",
                "experience": 12
            },
            {
                "id": "mentor_david",
                "name": "David Kumar",
                "expertise": "Product Management",
                "experience": 5
            }
        ]
    }

@app.get("/api/mentorhub/chats/{mentor_id}")
def get_mentor_chats(mentor_id: str):
    # Returns all chats where this mentor is a participant
    mentor_chats = []
    for chat_id, chat_data in chats_db.items():
        if chat_data["mentorId"] == mentor_id:
            last_message = ""
            if chat_data["messages"]:
                last_message = chat_data["messages"][-1]["text"]
                
            mentor_chats.append({
                "id": chat_id,
                "studentId": chat_data["studentId"],
                "studentUsername": chat_data["studentUsername"],
                "lastMessage": last_message
            })
    return {"chats": mentor_chats}

@app.get("/api/mentorhub/chat/{chat_id}/messages")
def get_chat_messages(chat_id: str):
    if chat_id not in chats_db:
        return {"messages": []}
    return {"messages": chats_db[chat_id]["messages"]}

class SendMessageRequest(BaseModel):
    chatId: str
    text: str
    senderId: str
    mentorId: str
    studentId: str
    studentUsername: str

@app.post("/api/mentorhub/chat/messages")
def send_chat_message(request: SendMessageRequest):
    if request.chatId not in chats_db:
        # Create new chat channel
        chats_db[request.chatId] = {
            "id": request.chatId,
            "studentId": request.studentId,
            "studentUsername": request.studentUsername,
            "mentorId": request.mentorId,
            "messages": []
        }
    
    # Append message
    chats_db[request.chatId]["messages"].append({
        "senderId": request.senderId,
        "text": request.text,
        "timestamp": str(datetime.now())
    })
    return {"success": True}

# ------------------------------
# V14 Intelligent Job Matchmaker
# ------------------------------
from fastapi import Query
from fastapi.responses import JSONResponse

@app.get("/api/jobs/match")
def match_jobs(role: str = Query(..., description="Target Job Role"), location: str = Query(None, description="Target City/Location")):
    try:
        from jobspy import scrape_jobs
        
        loc = location if location else "Remote"
        print(f"[JobSpy] Hunting for {role} in {loc}...")
        
        jobs_df = scrape_jobs(
            site_name=["indeed", "linkedin"],
            search_term=role,
            location=loc,
            results_wanted=8
        )
        
        if jobs_df is None or jobs_df.empty:
            return JSONResponse(content=[])
            
        cols = ['title', 'company', 'location', 'job_url']
        # Filter columns to only what exists in the DF in case of missing data
        available_cols = [c for c in cols if c in jobs_df.columns]
        jobs_df = jobs_df[available_cols].fillna("Unknown")
        
        jobs_list = jobs_df.to_dict(orient='records')
        return JSONResponse(content=jobs_list)

    except Exception as e:
        print(f"[JobSpy] Extraction Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(content=[], status_code=500)

# ------------------------------
# V13 WebRTC Signaling Server
# ------------------------------
class CallConnectionManager:
    def __init__(self):
        # Maps room_id -> list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        print(f"[WebRTC] Client joined Room {room_id}. Total: {len(self.active_connections[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            print(f"[WebRTC] Client left Room {room_id}. Remaining: {len(self.active_connections[room_id])}")
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    try:
                        await connection.send_text(message)
                    except Exception as e:
                        print(f"Failed to send to peer: {str(e)}")

call_manager = CallConnectionManager()

@app.websocket("/ws/call/{room_id}")
async def websocket_call_endpoint(websocket: WebSocket, room_id: str):
    await call_manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Relay SDP Offer/Answer/ICE payload exactly to the specific room, ignoring the sender
            await call_manager.broadcast_to_room(data, room_id, websocket)
    except WebSocketDisconnect:
        call_manager.disconnect(websocket, room_id)
        # Inform the remaining peer that their partner has dropped
        await call_manager.broadcast_to_room('{"type": "peer-disconnected"}', room_id, websocket)

# ------------------------------
# Production Bootloader
# ------------------------------
if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    # Bind to 0.0.0.0 for Docker/Cloud environments
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
