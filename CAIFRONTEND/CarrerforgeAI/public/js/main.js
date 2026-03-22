// Authentication session handling is managed by auth.js and localStorage

// ---- V16: Global Activity Logger ----
window.logActivity = async function(type, title, detail = '') {
    const uid = localStorage.getItem('userId');
    if (!uid) return;
    try {
        await fetch('${API_BASE_URL}/api/user/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, type, title, detail })
        });
    } catch(e) { /* silent fail — don't block UX */ }
};

// ---- V11 INITIALIZE THEME ----
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

document.addEventListener('DOMContentLoaded', () => {
  const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
  const sidebarEl = document.getElementById('sidebar');
  // ---- Theme Toggle Logic ----
  const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
  if (themeToggleCheckbox) {
      // Sync checkbox state with loaded theme
      if (savedTheme === 'light') themeToggleCheckbox.checked = true;
      
      themeToggleCheckbox.addEventListener('change', (e) => {
          const newTheme = e.target.checked ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', newTheme);
          localStorage.setItem('theme', newTheme);
      });
  }
  
  // Floating Return button removed — tool pages now have dedicated top-left back links


  // ---- Synchronized Page Loading ----
  const splineIframe = document.querySelector('.bg-spline');
  const body = document.body;
  
  const finishLoading = () => {
    if (!body.classList.contains('page-loaded')) {
      body.classList.add('page-loaded');
    }
  };

  if (splineIframe) {
    splineIframe.onload = finishLoading;
    
    // Check if already loaded
    if (splineIframe.contentDocument && splineIframe.contentDocument.readyState === 'complete') {
      finishLoading();
    }
    
    // Safety Fallback: Load anyway after 2 seconds if Spline is too slow
    setTimeout(finishLoading, 2000);
  } else {
    finishLoading();
  }

  // ---- Replay fade-in when elements scroll into view (for future sections) ----
  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe any elements with .reveal class (for future pages/sections)
  document.querySelectorAll('.reveal').forEach(el => {
    revealObserver.observe(el);
  });

  // ---- Authentication & Account Logic ----
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'student';
  const userAccount = document.getElementById('userAccount');
  const userAvatar = document.getElementById('userAvatar');
  const loginLink = document.getElementById('loginLink');
  const logoutBtn = document.getElementById('logoutBtn');

  // Auto-redirect mentors to their dashboard ONLY right after login (one-time)
  const justLoggedIn = !sessionStorage.getItem('mentorRedirected');
  if (isLoggedIn && userRole === 'mentor' && justLoggedIn && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
    sessionStorage.setItem('mentorRedirected', 'true');
    window.location.href = '/mentor-dashboard';
    return;
  }

  if (isLoggedIn) {
    if (userAccount) userAccount.style.display = 'block';
    if (loginLink) loginLink.style.display = 'none';
    if (userAvatar) userAvatar.textContent = userName.charAt(0).toUpperCase();
  } else {
    if (userAccount) userAccount.style.display = 'none';
    if (loginLink) loginLink.style.display = 'block';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      window.location.href = '/';
    });
  }

  // ---- Interactive Card Reveal ----
  const startBtn = document.getElementById('startBtn');
  const cardsRow = document.getElementById('cardsRow');

  if (startBtn && cardsRow) {
    // Check if we just came back from a tool (query indicator)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('revealed') === 'true') {
      startBtn.classList.add('hide-btn');
      startBtn.style.display = 'none';
      cardsRow.classList.add('show-cards');
      cardsRow.style.transition = 'none'; // Instant reveal when coming back
      
      const wrappers = cardsRow.querySelectorAll('.card-wrapper');
      wrappers.forEach(w => w.style.transition = 'none');

      // Make hero text instant to sync with cards
      document.querySelectorAll('.hero-text .fade-in').forEach(el => {
        el.style.animation = 'none';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });

      // Clear the parameter so a subsequent refresh shows the button again
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // LOGIN GATE
      if (!isLoggedIn) {
        window.location.href = '/login';
        return;
      }

      // 1. Fade out button
      startBtn.classList.add('hide-btn');
      
      // 2. Show cards after a tiny delay
      setTimeout(() => {
        cardsRow.style.transition = ''; // Ensure transitions are active
        cardsRow.classList.add('show-cards');
        
        // Add staggered delay to wrappers for better entrance
        const wrappers = cardsRow.querySelectorAll('.card-wrapper');
        wrappers.forEach((wrapper, index) => {
          wrapper.style.transition = ''; 
          wrapper.style.transitionDelay = `${index * 0.15}s`;
        });
      }, 100);
    });
  }

  // ---- Sidebar Toggle ----
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (menuToggle && sidebar && sidebarOverlay) {
    const toggleSidebar = () => {
      menuToggle.classList.toggle('active');
      sidebar.classList.toggle('active');
      sidebarOverlay.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    };

    menuToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // Close sidebar on link click
    sidebar.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', toggleSidebar);
    });
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

});
