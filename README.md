# News-Dash

A full-stack news reader with account-based summary saving, built on the MERN stack.

## Overview

News-Dash fetches live news through the GNews API and generates article summaries using Google's Gemini API. It has an Express/MongoDB backend and a React frontend. Signed-in users can save generated summaries to a personal account and view them later on a dashboard.

## Features

- Browse and filter news articles by category, sourced from the GNews API
- Keyword search across articles
- AI-generated article summaries, produced via Google's Gemini API (gemini-1.5-flash-latest)
- Save a summary to your account and retrieve it later on your dashboard (requires sign-in)
- JWT-based signup/login, with passwords hashed via bcrypt

## Tech stack

- Frontend: React 18, Tailwind CSS, Create React App
- Backend: Node.js, Express 5, MongoDB (Mongoose)
- External APIs: GNews (news data), Google Gemini (gemini-1.5-flash-latest, summarization)
- Auth: JSON Web Tokens (jsonwebtoken), bcryptjs for password hashing

## Setup

Clone the repository:

    git clone https://github.com/D-Majumder/News-Dash

### Backend

    cd server
    npm install

Create a .env file in server/ with the following four variables:

    MONGO_URI=<your MongoDB connection string>
    JWT_SECRET=<any secret string used to sign tokens>
    GNEWS_API_KEY=<your GNews API key>
    GEMINI_API_KEY=<your Gemini API key>

Start the server:

    npm start

### Frontend

    cd client
    npm install
    npm start

By default, the client points at a deployed backend at https://news-dash-backend.onrender.com rather than localhost. To run against your own local backend instead, update the API_BASE_URL constant in client/src/App.js.

## Live demo

https://dm-newsdash.netlify.app/

## Limitations

The backend is hosted on Render's free tier, which spins down after a period of inactivity. At the time of this writing, a direct request to the backend did not receive a response within 45 seconds. This may reflect a cold-start delay on Render's free tier, or the service being temporarily unavailable — it is a point-in-time observation, not a claim that the backend is permanently down. The live demo above may be slow to load data, or may show an error, until the backend has fully restarted.

## License

See LICENSE for terms.
