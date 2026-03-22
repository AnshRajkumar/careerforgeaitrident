// public/js/auth.js

// Keep localStorage in sync with our custom auth state
export function getSessionUser() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) return null;
    
    return {
        uid: localStorage.getItem('userId'),
        email: localStorage.getItem('userEmail'),
        name: localStorage.getItem('userName'),
        picture: localStorage.getItem('userPicture'),
        role: localStorage.getItem('userRole') || 'student'
    };
}

export function setSessionUser(userData, role) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userId', userData.uid);
    localStorage.setItem('userEmail', userData.email);
    localStorage.setItem('userName', userData.name);
    if (userData.picture) localStorage.setItem('userPicture', userData.picture);
    localStorage.setItem('userRole', role);
}

export function clearSession() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userPicture');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('mentorRedirected');
}

// Global logout function for main.js to call
window.logoutFirebase = async () => {
    // We kept the name 'logoutFirebase' on the window object so we don't have to change 
    // too much in main.js, but it's now just a local session clear.
    clearSession();
};

// Function called by Google Sign-In script when login is successful
export async function handleGoogleLogin(response, role) {
    const credential = response.credential;
    
    try {
        // Send the token to our backend to verify and start a session
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: credential })
        });
        
        const data = await res.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Success
        setSessionUser(data.user, role);
        console.log(`Login successful for ${data.user.email}`);
        
        // Redirect based on role
        if (role === 'mentor') {
            window.location.href = '/mentor-dashboard';
        } else {
            window.location.href = '/?revealed=true';
        }
        
    } catch (e) {
        console.error("Google Login failed", e);
        alert("Google Login failed. Please try again.");
    }
}
