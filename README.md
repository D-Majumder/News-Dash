<h1 align="center" id="title">News-Dash</h1>

<p align="center"><img src="https://socialify.git.ci/D-Majumder/News-Dash/image?font=Raleway&amp;forks=1&amp;issues=1&amp;language=1&amp;name=1&amp;owner=1&amp;pattern=Floating+Cogs&amp;pulls=1&amp;stargazers=1&amp;theme=Auto" alt="project-image"></p>

<p id="description">A full-stack news application built with the MERN stack (MongoDB Express React Node.js). Features real-time news fetching from the GNews API AI-powered article summarization via Google's Gemini and secure user authentication with JWT. Users can browse search and save AI-generated summaries to their personal dashboard.</p>

<p align="center"><img src="https://img.shields.io/badge/React_Js-Am_Dumb-blue" alt="shields"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="shields"><img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&amp;logo=react&amp;logoColor=%2361DAFB)" alt="shields"><img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&amp;logo=node.js&amp;logoColor=white" alt="shields"><img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&amp;logo=express&amp;logoColor=%2361DAFB" alt="shields"><img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&amp;logo=mongodb&amp;logoColor=white" alt="shields"><img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&amp;logo=tailwind-css&amp;logoColor=white" alt="shields"></p>

<h2>🚀 Demo</h2>

[https://dm-newsdash.netlify.app/](https://dm-newsdash.netlify.app/)

  
  
<h2>🧐 Features</h2>

Here're some of the project's best features:

*   Live News Feed: The app fetches and displays up-to-the-minute news articles from a live global news API (GNews).
*   Dynamic Content Filtering: Users can instantly filter the news feed by clicking on various categories like "Business" "Technology" or "Sports."
*   Keyword Search: A fully functional search bar allows users to find articles on any topic they choose.
*   Trending News Section: A dedicated "Trending" tab shows the most important breaking headlines.
*   Interactive Article Cards: A clean grid-based layout of news articles that are interactive on hover.
*   Detailed Article View: Clicking an article opens a modal with more details including a description and a direct link to the original source.

<h2>🛠️ Installation Steps:</h2>

<p>1. Clone the repository:</p>

```
git clone https://github.com/D-Majumder/News-Dash
```
<p>2. Set up the Backend:</p>

```
- Navigate to the /server directory.
- Follow the instructions in the server/README.md file to install dependencies, set up your .env file with your secret keys, and start the server.
```
<p>3. Set up the Frontend:</p>

```
- Navigate to the /client directory.
- Install dependencies: npm install
- Start the React application: npm start

The frontend will open at http://localhost:3000 and will automatically connect to your local backend server running on port 5000.
```
<p>4.  Environment Variables:</p>

```
-The backend requires a .env file in the /server directory. Create this file by copying the .env.example file and filling in your secret keys.
/*/.env
# Get your key from [https://gnews.io/](https://gnews.io/)
GNEWS_API_KEY=PASTE_YOUR_GNEWS_API_KEY_HERE

# Get your key from [https://ai.google.dev/](https://ai.google.dev/)
GEMINI_API_KEY=PASTE_YOUR_GEMINI_API_KEY_HERE

# Get your connection string from MongoDB Atlas
MONGO_URI=PASTE_YOUR_MONGODB_CONNECTION_STRING_HERE

# Make up any random, secret phrase for signing JWTs
JWT_SECRET=YOUR_RANDOM_SECRET_STRING_GOES_HERE
```

<h2>💻 Built with</h2>

Technologies used in the project:

*   React
*   Tailwind CSS
*   Node.js
*   Express.js
*   Axios
*   MongoDB
*   Mongoose
*   JSON Web Tokens
*   bcrypt.js
*   dotenv
*   Google Gemini API
*   GNews API
*   Netlify
*   Render
*   Git & GitHub

<h2>🛡️ License:</h2>

This project is licensed under the GNU
