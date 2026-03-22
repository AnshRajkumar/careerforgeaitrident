import requests
url = "http://127.0.0.1:8000/career_analysis?role=Data+Scientist"
try:
    files = {'file': open("d:/careerforgeai/temp_My resume.pdf", 'rb')}
    r = requests.post(url, files=files)
    print(r.status_code, r.text[:200])
except Exception as e:
    print("Error:", e)
