const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const publicDir = path.join(__dirname, '..', 'public');

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/features', (req, res) => {
  res.sendFile(path.join(publicDir, 'features.html'));
});

app.get('/career', (req, res) => {
  res.sendFile(path.join(publicDir, 'career.html'));
});

app.get('/mock-interview', (req, res) => {
  res.sendFile(path.join(publicDir, 'interview.html'));
});

app.get('/resume-parser', (req, res) => {
  res.sendFile(path.join(publicDir, 'resume-parser.html'));
});

app.get('/guidance', (req, res) => {
  res.sendFile(path.join(publicDir, 'guidance.html'));
});

app.get('/hot-topics', (req, res) => {
  res.sendFile(path.join(publicDir, 'hot-topics.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(publicDir, 'contact.html'));
});

app.get('/review', (req, res) => {
  res.sendFile(path.join(publicDir, 'review.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(publicDir, 'terms.html'));
});

app.get('/release-notes', (req, res) => {
  res.sendFile(path.join(publicDir, 'release-notes.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/login-admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'login-admin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(publicDir, 'signup.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
});

app.get('/mentor-dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'mentor-dashboard.html'));
});

app.get('/vargo', (req, res) => {
  res.sendFile(path.join(publicDir, 'vargo.html'));
});

app.get('/mentor-hub', (req, res) => {
  res.sendFile(path.join(publicDir, 'mentor-hub.html'));
});

app.get('/mentor-chat', (req, res) => {
  res.sendFile(path.join(publicDir, 'mentor-chat.html'));
});

app.get('/college-login', (req, res) => {
  res.sendFile(path.join(publicDir, 'college-login.html'));
});

app.get('/college-dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'college-dashboard.html'));
});

// Non-Technical Section Routes
app.get('/non-tech-features', (req, res) => {
  res.sendFile(path.join(publicDir, 'non-tech-features.html'));
});

app.get('/expert-chat', (req, res) => {
  res.sendFile(path.join(publicDir, 'expert-chat.html'));
});

app.get('/career-explorer', (req, res) => {
  res.sendFile(path.join(publicDir, 'career-explorer.html'));
});

app.get('/soft-skills-quiz', (req, res) => {
  res.sendFile(path.join(publicDir, 'soft-skills-quiz.html'));
});

app.listen(port, () => {
  console.log(`Careerforge AI listening at http://localhost:${port}`);
});
