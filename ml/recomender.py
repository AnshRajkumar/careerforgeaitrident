import os
import pandas as pd

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
courses_df = pd.read_csv(os.path.join(_PROJECT_ROOT, "data", "courses.csv"))

def recommend_courses(missing_skills):

    recommendations = []

    for skill in missing_skills:

        course = courses_df[courses_df["skill"] == skill]

        if not course.empty:

            recommendations.append({
                "skill": skill,
                "course": course.iloc[0]["course"],
                "platform": course.iloc[0]["platform"]
            })

    return recommendations