from ml.user_context import get_user_profile
from ml.vargo_assistant import groq_response


# ------------------------------
# Helper: call Groq via vargo_assistant
# ------------------------------
def _groq_call(prompt):
    return groq_response(prompt)


# ------------------------------
# AI Question Generator
# ------------------------------
def generate_question(state=None):
    
    if state is None:
        role = "Software Engineer"
        experience = "Mid Level"
        stack = "General"
        company = "a top tech company"
        round_num = 1
    else:
        role = state.get("role", "Software Engineer")
        experience = state.get("experience", "Mid Level")
        stack = state.get("stack", "General")
        company = state.get("company", "a top tech company")
        round_num = state.get("round", 1)

    try:
        raw_response = _groq_call(f"""
You are {company}'s Head of Engineering conducting a strict, proctored mock interview.

Candidate Profile:
Role: {role}
Experience Level: {experience}
Tech Stack: {stack}
Current Round Number: {round_num}

Instructions:
1. Use your knowledge of {company}'s actual interview processes (e.g., Amazon Leadership Principles, Googleyness, etc.) to determine the focus of this round based on Round Number {round_num}.
2. Formulate ONE highly specific interview question tailored to {company}'s hiring standards for a {experience} level {role}.
3. Determine a strict but realistic time limit (in minutes) for the candidate to answer this question (e.g., 5, 10, or 15).
4. You MUST output your response strictly as a JSON object with exactly these three keys:
   - "round_name": A string describing this specific company's round (e.g. "Round 2: Systems Architecture").
   - "question": The actual interview question string.
   - "time_limit_minutes": An integer representing the time limit.

Return ONLY the raw JSON object. Do not wrap it in markdown blockticks like ```json.
""")
        import json
        cleaned = raw_response.replace('```json', '').replace('```', '').strip()
        return json.loads(cleaned)
        
    except Exception as e:
        print("Question Generation Error:", e)
        return {
            "round_name": f"Round {round_num}",
            "question": "System Error: Could not generate custom question. Describe a challenging project you've built.",
            "time_limit_minutes": 5
        }

# ------------------------------
# AI Answer Evaluation
# ------------------------------
def evaluate_answer(question, answer):

    try:
        return _groq_call(f"""
You are an expert technical interviewer.

Question: {question}
Candidate Answer: {answer}

Evaluate the answer based on:
1. Technical accuracy
2. Clarity
3. Depth

Respond strictly in this format:

Score: X/10
Strength:
Weakness:
Improvement:
""")
    except Exception as e:
        print("Evaluation Error:", e)
        return "Evaluation failed."


# ------------------------------
# AI Follow-up Question
# ------------------------------
def generate_followup(question, answer):

    try:
        return _groq_call(f"""
You are an expert interviewer.

Original Question: {question}
Candidate Answer: {answer}

Ask a relevant follow-up question to go deeper.

Only output the follow-up question.
""")
    except Exception as e:
        print("Follow-up Error:", e)
        return "Could not generate follow-up."