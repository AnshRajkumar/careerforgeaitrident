document.addEventListener('DOMContentLoaded', () => {
    const roadmapForm = document.getElementById('roadmapForm');
    const resultsSection = document.getElementById('resultsSection');
    const roadmapSteps = document.getElementById('roadmapSteps');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    // Handle initial selection from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type') || 'technical';
    const btnIcon = document.getElementById('btnIcon');

    // Dynamically set button name based on path
    if (typeParam === 'technical') {
        btnText.textContent = 'Generate Technical Roadmap';
    } else {
        btnText.textContent = 'Generate Non-Technical Roadmap';
    }

    roadmapForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            career: document.getElementById('career').value,
            skills: document.getElementById('skills').value,
            type: typeParam
        };

        // Show loading state
        btnText.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'none';
        btnLoader.style.display = 'block';
        roadmapForm.style.opacity = '0.7';
        roadmapForm.style.pointerEvents = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/career_roadmap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to generate roadmap');
            }

            const data = await response.json();
            displayRoadmap(data.roadmap || data); // Adjust based on actual API response structure
            
        } catch (error) {
            console.error('Error:', error);
            // Fallback for demo if API fails
            showFallbackRoadmap(formData.career);
        } finally {
            btnText.style.display = 'block';
            if (btnIcon) btnIcon.style.display = 'block';
            btnLoader.style.display = 'none';
            roadmapForm.style.opacity = '1';
            roadmapForm.style.pointerEvents = 'all';
        }
    });

    function displayRoadmap(steps) {
        resultsSection.style.display = 'block';
        roadmapSteps.innerHTML = '';
        
        // Handle both experimental/real API structures
        const roadmapData = Array.isArray(steps) ? steps : [
            { title: "Foundations", description: `Start by mastering the core principles of ${steps.career || 'your chosen field'}.` },
            { title: "Skill Building", description: "Deep dive into specialized tools and frameworks." },
            { title: "Portfolio Development", description: "Build real-world projects to showcase your skills." },
            { title: "Interview Prep", description: "Final preparation for technical and behavioral interviews." }
        ];

        roadmapData.forEach((step, index) => {
            const card = document.createElement('div');
            card.className = 'glass-card step-card fade-in';
            card.style.animationDelay = `${(index + 1) * 0.2}s`;
            
            card.innerHTML = `
                <div class="step-number">Step ${index + 1}</div>
                <h3 class="step-title">${step.title}</h3>
                <p class="step-desc">${step.description}</p>
            `;
            
            roadmapSteps.appendChild(card);
        });

        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function showFallbackRoadmap(career) {
        const fallbackData = [
            { title: "Skill Assessment", description: `Evaluation of your current skills against ${career} requirements.` },
            { title: "Core Learning", description: "Focus on the fundamental knowledge required for the role." },
            { title: "Practical Application", description: "Completing projects and gaining hands-on experience." },
            { title: "Job Ready", description: "Preparing the resume and practicing for interviews." }
        ];
        displayRoadmap(fallbackData);
    }
});
