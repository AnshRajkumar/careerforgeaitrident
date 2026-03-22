import random

questions = {
    "machine_learning_engineer": [
        "Explain overfitting in machine learning.",
        "What is gradient descent?",
        "What is the difference between supervised and unsupervised learning?",
        "Explain bias vs variance.",
        "What is backpropagation?"
    ],

    "data_scientist": [
        "What is hypothesis testing?",
        "Explain p-value.",
        "What is feature engineering?",
        "Difference between regression and classification?",
        "What is a confusion matrix?"
    ],

    "backend_developer": [
        "What is REST API?",
        "Explain microservices architecture.",
        "What is Docker?",
        "What is database indexing?",
        "Difference between SQL and NoSQL?"
    ]
}

def generate_question(role):
    role_questions = questions.get(role, [])
    return random.choice(role_questions)

def evaluate_answer(answer):

    length_score = min(len(answer) / 50, 5)

    keywords = [
        "model",
        "data",
        "algorithm",
        "training",
        "learning",
        "optimization"
    ]

    keyword_score = sum(1 for k in keywords if k in answer.lower())

    total_score = round(length_score + keyword_score)

    if total_score > 10:
        total_score = 10

    feedback = "Good answer but could include more technical depth."

    if total_score >= 8:
        feedback = "Strong answer with good explanation."

    if total_score <= 4:
        feedback = "Answer lacks technical clarity."

    return {
        "score": total_score,
        "feedback": feedback
    }