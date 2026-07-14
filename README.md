# My Tasks — Sample App

A simple, polished to-do list web app built with plain HTML, CSS, and JavaScript. No build tools, no dependencies — just open it in a browser.

## Features

- ✅ Add, complete, and delete tasks
- 🔍 Filter by All / Active / Completed
- 💾 Tasks are saved in your browser (localStorage), so they persist across reloads
- 🧹 One-click "Clear completed"
- 🌙 Automatic light/dark mode based on your system theme
- 📱 Responsive — works on mobile and desktop

## Getting started

Just open `index.html` in any modern browser:

```bash
# Option 1: open the file directly
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# Option 2: serve it locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html   # Page markup
style.css    # Styling (light + dark themes)
app.js       # App logic and localStorage persistence
```
