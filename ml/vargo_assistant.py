import os
import speech_recognition as sr
import pyttsx3
from groq import Groq
from dotenv import load_dotenv

from ml.user_context import get_user_profile
from ml.multi_rag import get_combined_context

# ------------------------------
# LOAD ENV
# ------------------------------
load_dotenv()

# ------------------------------
# CONFIG
# ------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY)


# ------------------------------
# GROQ RESPONSE
# ------------------------------
def groq_response(prompt):

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are VarGo, an AI assistant."},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content


# ------------------------------
# MAIN RESPONSE (MULTI-RAG)
# ------------------------------
def generate_response(query, user_id=None):

    profile = get_user_profile()

    # ------------------------------
    # 🔥 MULTI-RAG CONTEXT
    # ------------------------------
    context_text = ""

    try:
        if user_id:
            context_text = get_combined_context(user_id, query)
    except Exception as e:
        print("RAG ERROR:", e)

    # ------------------------------
    # PROMPT
    # ------------------------------
    prompt = f"""
You are VarGo, an AI assistant.

User Profile:
- Career Role: {profile.get('career_role')}
- Known Skills: {profile.get('skills')}
- Missing Skills: {profile.get('missing_skills')}

Context (Resume + Job + Courses):
{context_text if context_text else "No context available"}

Instructions:
- Use ALL context sources intelligently
- Prioritize job requirements over resume
- Suggest improvements using course data
- Be highly personalized
- Give actionable advice

User Question:
{query}
"""

    # ------------------------------
    # RESPONSE
    # ------------------------------
    try:
        return groq_response(prompt)
    except Exception as e:
        print("AI ERROR:", str(e))
        return f"AI ERROR: {str(e)}"


# ------------------------------
# VOICE INPUT
# ------------------------------
def voice_to_text():

    recognizer = sr.Recognizer()

    with sr.Microphone() as source:
        print("🎤 Listening...")
        audio = recognizer.listen(source)

    try:
        return recognizer.recognize_google(audio)
    except Exception as e:
        print("Speech Error:", e)
        return ""


# ------------------------------
# VOICE OUTPUT
# ------------------------------
engine = None
try:
    engine = pyttsx3.init()
except Exception as e:
    print("[CareerForgeAI] Local TTS engine disabled (Running in Headless Cloud Mode).")

def speak(text):
    if engine:
        engine.say(text)
        engine.runAndWait()
    else:
        print(f"[Headless Voice Output]: {text}")


# ------------------------------
# VOICE CHAT
# ------------------------------
def vargo_voice_assistant(user_id=None):

    query = voice_to_text()
    print("🧑 User:", query)

    response = generate_response(query, user_id)
    print("🤖 VarGo:", response)

    speak(response)


# ------------------------------
# VOICE INTERVIEW MODE
# ------------------------------
def voice_interview(user_id=None):
    from ml.interview_engine import generate_question, evaluate_answer, generate_followup

    print("🎤 Starting Voice Interview...")

    question = generate_question()
    speak(question)

    while True:

        answer = voice_to_text()

        if not answer:
            continue

        print("User:", answer)

        if "stop" in answer.lower():
            speak("Interview ended.")
            break

        evaluation = evaluate_answer(question, answer)
        followup = generate_followup(question, answer)

        speak("Here is your evaluation")
        speak(evaluation)

        speak("Next question")
        speak(followup)

        question = followup