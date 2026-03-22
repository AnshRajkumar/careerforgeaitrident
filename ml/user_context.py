user_profile = {
    "skills": [],
    "missing_skills": [],
    "career_role": ""
}


def update_user_profile(skills, missing_skills, role):
    user_profile["skills"] = skills
    user_profile["missing_skills"] = missing_skills
    user_profile["career_role"] = role


def get_user_profile():
    return user_profile