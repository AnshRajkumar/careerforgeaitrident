def calculate_readiness_score(detected_skills, missing_skills):

    total_skills = len(detected_skills) + len(missing_skills)

    if total_skills == 0:
        return {
            "score": 0,
            "level": "Beginner"
        }

    skill_ratio = len(detected_skills) / total_skills

    score = round(skill_ratio * 100)

    if score >= 80:
        level = "Job Ready"

    elif score >= 60:
        level = "Intermediate"

    else:
        level = "Beginner"

    return {
        "career_readiness_score": score,
        "level": level
    }