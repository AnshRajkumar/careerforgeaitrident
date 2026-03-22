import csv
from jobspy import scrape_jobs

print("Starting job scrape...")
jobs = scrape_jobs(
    site_name=["indeed", "linkedin", "glassdoor"],
    search_term="software engineer",
    location="San Francisco, CA",
    results_wanted=5,
    country_indeed='USA'
)

print(f"Found {len(jobs)} jobs")
print(jobs[['title', 'company', 'location', 'job_url']].head())
