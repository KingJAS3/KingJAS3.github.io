// main.jsx — the entry point that mounts the React app into the HTML page.
// React needs a DOM element to "attach" to; we use the <div id="root"> from index.html.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// ReactDOM.createRoot creates a React root and .render() puts our App component inside it.
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode runs extra checks during development to catch bugs early (no effect in production).
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
