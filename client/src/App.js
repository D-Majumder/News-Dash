import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'https://news-dash-backend.onrender.com';

const callBackendAPI = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data;
};

const NewsDashLogo = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
        <path d="M19 20H5C3.89543 20 3 19.1046 3 18V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V18C21 19.1046 20.1046 20 19 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 8H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 12H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const ThemeToggle = ({ theme, setTheme }) => {
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return (
    <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900">
      {theme === 'dark' ? ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 18.36l1.42-1.42M18.36 4.22l1.42-1.42"/></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> )}
    </button>
  );
};

const ArticleCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-md overflow-hidden animate-pulse">
        <div className="w-full h-48 bg-gray-300 dark:bg-gray-700"></div>
        <div className="p-4"><div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div><div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mt-4"></div></div>
    </div>
);

const Header = ({ theme, setTheme, page, setPage, token, setToken, onSearch }) => {
  const [query, setQuery] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('synapse-token');
    setToken(null);
    setPage('home');
  };

  const handleSearchSubmit = (e) => {
      e.preventDefault();
      if (query.trim()) {
          onSearch(query.trim());
          setPage('home');
          setQuery('');
      }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-md">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setPage('home'); onSearch(null); }}>
            <NewsDashLogo />
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">NewsDash</h1>
          </div>
          <div className="hidden md:flex items-center space-x-2">
             <button onClick={() => { setPage('home'); onSearch(null); }} className={`px-3 py-2 rounded-md text-sm font-medium ${page === 'home' ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-800`}>Home</button>
             {token && <button onClick={() => setPage('summaries')} className={`px-3 py-2 rounded-md text-sm font-medium ${page === 'summaries' ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-800`}>My Summaries</button>}
          </div>
          <div className="flex items-center space-x-4">
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for news..." className="w-48 px-3 py-1.5 rounded-l-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              <button type="submit" className="px-3 py-1.5 rounded-r-md bg-blue-500 text-white text-sm hover:bg-blue-600">Search</button>
            </form>
            {token ? (
              <button onClick={handleLogout} className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600">Logout</button>
            ) : (
              <div className="flex items-center space-x-2">
                <button onClick={() => setPage('login')} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Login</button>
                <button onClick={() => setPage('signup')} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600">Sign Up</button>
              </div>
            )}
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </nav>
    </header>
  );
};

const HomePage = ({ onArticleClick, filter, setFilter }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNews = async (currentFilter) => {
        setLoading(true);
        setError('');
        let endpoint = '/api/news?';
        if (currentFilter.type === 'category') {
            endpoint += `category=${currentFilter.value}`;
        } else if (currentFilter.type === 'search') {
            endpoint += `q=${encodeURIComponent(currentFilter.value)}`;
        }
        try {
            const data = await callBackendAPI(endpoint);
            setArticles(data.articles || []);
        } catch (err) {
            setError(err.message);
            setArticles([]);
        } finally {
            setLoading(false);
        }
    };
    fetchNews(filter);
  }, [filter]);

  const getTitle = () => {
      if (filter.type === 'category') {
          if (filter.value === 'general') return "Trending Headlines";
          return `Top Stories in ${filter.value.charAt(0).toUpperCase() + filter.value.slice(1)}`;
      }
      if (filter.type === 'search') {
          return `Search Results for "${filter.value}"`;
      }
      return "News";
  };

  return (
    <div>
      <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setFilter({ type: 'category', value: 'general' })} className={`px-4 py-2 text-sm font-medium rounded-full ${filter.value === 'general' && filter.type === 'category' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Trending</button>
        {['Business', 'Technology', 'Sports', 'Health', 'Science'].map(category => (
          <button key={category} onClick={() => setFilter({ type: 'category', value: category.toLowerCase() })} className={`px-4 py-2 text-sm font-medium rounded-full ${filter.value === category.toLowerCase() ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {category}
          </button>
        ))}
      </div>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6">{getTitle()}</h2>
        {loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{Array.from({ length: 8 }).map((_, i) => <ArticleCardSkeleton key={i} />)}</div>}
        {error && <div className="text-center p-8 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</div>}
        {!loading && !error && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {articles.map((article) => <ArticleCard key={article.url} article={article} onArticleClick={onArticleClick} />)}
          </div>
        )}
        {!loading && !error && articles.length === 0 && <p className="text-center">No articles found for your request.</p>}
      </div>
    </div>
  );
};

const ArticleCard = ({ article, onArticleClick }) => (
  <div onClick={() => onArticleClick(article)} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-1 group">
    <div className="overflow-hidden"><img src={article.urlToImage} alt={article.title} className="w-full h-48 object-cover" /></div>
    <div className="p-4"><h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-500 line-clamp-2">{article.title}</h3><p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{article.source.name}</p></div>
  </div>
);

const ArticleDetailModal = ({ article, onClose, onSummarize }) => {
  if (!article) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <img src={article.urlToImage} alt={article.title} className="w-full h-64 object-cover rounded-t-lg" />
        <div className="p-6 flex-grow overflow-y-auto">
          <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
          <div className="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400 mb-4 gap-x-4 gap-y-1"><span>By {article.author || 'Unknown'}</span><span className="hidden sm:inline">•</span><span>{article.source.name}</span><span className="hidden sm:inline">•</span><span>{new Date(article.publishedAt).toLocaleDateString()}</span></div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{article.description}</p>
        </div>
        <div className="p-6 border-t dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-3">
          <button onClick={onSummarize} className="w-full sm:w-auto px-5 py-2 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600 order-1 sm:order-2">Summarise with AI</button>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-center px-5 py-2 rounded-md bg-gray-200 dark:bg-gray-600 order-2 sm:order-1">Read Full Article</a>
        </div>
      </div>
    </div>
  );
};

const AIInsightsModal = ({ article, token, onClose }) => {
    const [generatedContent, setGeneratedContent] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('summary');

    const generateContent = useCallback(async (type) => {
        const contentToSummarize = article.content || article.description;
        setLoading(true); setError(''); setSuccess(''); setGeneratedContent({ type: '', text: '' }); setActiveTab(type);
        let prompt = '';
        switch (type) {
            case 'eli5': prompt = `Explain this like I'm 5: ${contentToSummarize}`; break;
            case 'tweet': prompt = `Generate a tweet for this: ${contentToSummarize}`; break;
            default: prompt = `Summarize this in 3 bullet points: ${contentToSummarize}`; break;
        }
        try {
            const data = await callBackendAPI('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
            setGeneratedContent({ type, text: data.summary });
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    }, [article]);

    const handleSaveSummary = async () => {
        if (!generatedContent.text) { setError("No summary to save."); return; }
        setError(''); setSuccess('');
        try {
            await callBackendAPI('/api/summaries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title: article.title, source: article.source.name, url: article.url, summary: generatedContent.text })
            });
            setSuccess("Summary saved successfully!");
        } catch (err) { setError(err.message); }
    };

    useEffect(() => { if (article) generateContent('summary'); }, [article, generateContent]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}><div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700"><h2 className="text-xl font-bold">AI-Powered Insights</h2><p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{article.title}</p></div>
            <div className="p-6 flex-grow overflow-y-auto">
                <div className="flex justify-center gap-2 mb-4">
                    {['summary', 'eli5', 'tweet'].map(type => <button key={type} onClick={() => generateContent(type)} disabled={loading} className={`px-3 py-2 text-sm rounded-md ${activeTab === type && !loading ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}> {type.charAt(0).toUpperCase() + type.slice(1)} </button>)}
                </div>
                <div className="mt-4 min-h-[150px] p-4 bg-gray-100 dark:bg-gray-900/50 rounded-md">
                    {loading && <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
                    {error && <p className="text-red-500">{error}</p>}
                    {generatedContent.text && <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{generatedContent.text}</div>}
                </div>
            </div>
            <div className="p-6 border-t dark:border-gray-700 space-y-3">
                {token && <button onClick={handleSaveSummary} className="w-full px-4 py-2 rounded-md bg-green-500 text-white hover:bg-green-600">Save Summary</button>}
                {success && <p className="text-sm text-green-500 text-center">{success}</p>}
                <button onClick={onClose} className="w-full px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Close</button>
            </div>
        </div></div>
    );
};

const AuthForm = ({ isLogin, setPage, setToken }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
        try {
            const data = await callBackendAPI(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            localStorage.setItem('synapse-token', data.token);
            setToken(data.token);
            setPage('home');
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-8 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-center mb-6">{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div><label className="block mb-2 text-sm font-medium">Username</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" required /></div>
                <div><label className="block mb-2 text-sm font-medium">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md" required /></div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-400">{loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}</button>
            </form>
            <p className="text-center mt-4 text-sm">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => setPage(isLogin ? 'signup' : 'login')} className="text-blue-500 hover:underline">{isLogin ? 'Sign Up' : 'Login'}</button>
            </p>
        </div>
    );
};

const MySummariesPage = ({ token }) => {
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSummaries = async () => {
            try {
                const data = await callBackendAPI('/api/summaries', { headers: { 'Authorization': `Bearer ${token}` } });
                setSummaries(data);
            } catch (err) { setError(err.message); } finally { setLoading(false); }
        };
        if (token) fetchSummaries();
    }, [token]);

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">My Saved Summaries</h1>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!loading && !error && (
                summaries.length > 0 ? (
                    <div className="space-y-6">
                        {summaries.map(s => (
                            <div key={s._id} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                                <h2 className="text-xl font-bold mb-2">{s.title}</h2>
                                <p className="text-sm text-gray-500 mb-4">Source: {s.source}</p>
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap p-4 bg-gray-100 dark:bg-gray-700 rounded-md mb-4">{s.summary}</div>
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Read Full Article &rarr;</a>
                            </div>
                        ))}
                    </div>
                ) : <p>You haven't saved any summaries yet.</p>
            )}
        </div>
    );
};

const Footer = () => {
    const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const GithubIcon = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 16 16" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg>;
    const LinkedinIcon = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"></path></svg>;
    const TwitterIcon = () => <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"></path></svg>;
    const animationStyle = `@keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } } .heartbeat-icon { display: inline-block; animation: heartbeat 1.5s infinite; }`;
    return (
        <footer className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-8 border-t border-gray-200 dark:border-gray-700 text-center relative">
            <style>{animationStyle}</style>
            <div className="max-w-screen-xl mx-auto flex flex-col items-center gap-4">
                <div className="font-medium text-base text-gray-800 dark:text-gray-200">Made with <span className="heartbeat-icon">❤️</span> by Dhruba</div>
                <div className="flex gap-6 text-2xl">
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-blue-500 hover:-translate-y-1 transition-all duration-200"><GithubIcon /></a>
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-blue-500 hover:-translate-y-1 transition-all duration-200"><LinkedinIcon /></a>
                    <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="hover:text-blue-500 hover:-translate-y-1 transition-all duration-200"><TwitterIcon /></a>
                </div>
                <div className="flex gap-2 items-center text-sm">
                    <button onClick={() => alert('Terms of Service page coming soon!')} className="hover:text-blue-500">Terms</button>
                    <span>&bull;</span>
                    <button onClick={() => alert('Privacy Policy page coming soon!')} className="hover:text-blue-500">Privacy Policy</button>
                </div>
            </div>
            <button onClick={scrollToTop} aria-label="Back to top" className="absolute bottom-5 right-5 bg-blue-500 text-white rounded-full w-11 h-11 text-2xl flex justify-center items-center shadow-lg hover:bg-blue-600 hover:-translate-y-1 transition-all duration-300">⇧</button>
        </footer>
    );
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('synapse-theme') || 'light');
  const [page, setPage] = useState('home');
  const [token, setToken] = useState(() => localStorage.getItem('synapse-token') || null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState({ type: 'category', value: 'general' });

  useEffect(() => { 
      document.documentElement.className = theme;
      localStorage.setItem('synapse-theme', theme);
  }, [theme]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    document.body.style.fontFamily = "'Poppins', sans-serif";
  }, []);
  
  const handleArticleClick = (article) => { setSelectedArticle(article); setShowDetailModal(true); };
  const handleSummarizeClick = () => { setShowDetailModal(false); setShowAIModal(true); };
  const handleCloseModals = () => { setSelectedArticle(null); setShowDetailModal(false); setShowAIModal(false); };

  const renderPage = () => {
    switch (page) {
      case 'login': return <AuthForm isLogin={true} setPage={setPage} setToken={setToken} />;
      case 'signup': return <AuthForm isLogin={false} setPage={setPage} setToken={setToken} />;
      case 'summaries': return token ? <MySummariesPage token={token} /> : <AuthForm isLogin={true} setPage={setPage} setToken={setToken} />;
      case 'home':
      default: return <HomePage onArticleClick={handleArticleClick} filter={activeFilter} setFilter={setActiveFilter} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <Header theme={theme} setTheme={setTheme} page={page} setPage={setPage} token={token} setToken={setToken} onSearch={(query) => setActiveFilter({ type: 'search', value: query })} />
      <main className="pt-16 flex-grow">
        {renderPage()}
      </main>
      {showDetailModal && <ArticleDetailModal article={selectedArticle} onClose={handleCloseModals} onSummarize={handleSummarizeClick} />}
      {showAIModal && <AIInsightsModal article={selectedArticle} token={token} onClose={handleCloseModals} />}
      <Footer />
    </div>
  );
}
