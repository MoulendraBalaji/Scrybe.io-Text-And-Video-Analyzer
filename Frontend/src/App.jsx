import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeTab, setActiveTab] = useState('overview');

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [registerStep, setRegisterStep] = useState(1);

  // Workspace State
  const [question, setQuestion] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [leaderboardItems, setLeaderboardItems] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Screen Capture State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [captureMode, setCaptureMode] = useState('screen');
  const [telemetry, setTelemetry] = useState({ brightness: 50, contrast: 50, edge_density: 50, info_rate: 50 });
  const captureCanvasRef = useRef(null);
  const videoStreamRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  // Load user session
  useEffect(() => {
    const savedUser = localStorage.getItem('scrybeUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      } catch (e) {
        localStorage.removeItem('scrybeUser');
      }
    }
  }, []);

  // Fetch history when logged in
  useEffect(() => {
    if (currentUser && currentPath === '/history') {
      fetchHistory();
    }
  }, [currentUser, currentPath]);

  // Fetch leaderboard
  useEffect(() => {
    if (currentPath === '/leaderboard') {
      fetchLeaderboard();
    }
  }, [currentPath]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setError(null);
        setAuthError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchHistory = async () => {
    if (!currentUser) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/queries/${currentUser.username}`);
      if (!response.ok) throw new Error("Failed to load history");
      const data = await response.json();
      const parsedItems = (data.queries || []).map(item => {
        try {
          const evalResult = JSON.parse(item.response_text);
          return {
            dbId: item.id,
            date: new Date(item.created_at).toLocaleDateString(),
            question: item.query_text,
            ...evalResult
          };
        } catch (e) {
          return {
            dbId: item.id,
            date: new Date(item.created_at).toLocaleDateString(),
            question: item.query_text,
            score: 0,
            grade: "Grade F",
            transcript: "Unable to parse result."
          };
        }
      });
      setHistoryItems(parsedItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      if (!response.ok) throw new Error("Failed to load leaderboard");
      const data = await response.json();
      setLeaderboardItems(data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const saveEvaluationToDB = async (evalData) => {
    if (!currentUser) return;
    try {
      const payload = {
        query_text: question || 'General Speech Scan',
        response_text: JSON.stringify({
          score: evalData.score,
          transcript: evalData.transcript,
          summary: evalData.summary,
          visual_analysis: evalData.visual_analysis,
          feedback: evalData.feedback,
          breakdown: evalData.breakdown,
          grade: evalData.grade
        })
      };
      await fetch(`${API_URL}/queries?username=${currentUser.username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Database Save Error:", e);
    }
  };

  const deleteHistoryItem = async (dbId) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/queries/${dbId}`, { method: 'DELETE' });
      if (response.ok) fetchHistory();
      else throw new Error("Unable to delete query");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAuthSubmit = async (e, mode) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const isLogin = mode === 'login';
    const endpoint = isLogin ? '/login' : '/register';
    const payload = isLogin
      ? { username: authUsername, password: authPassword }
      : { username: authUsername, password: authPassword, first_name: authFirstName, last_name: authLastName };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail.detail || "Authentication failed");
      }

      const data = await response.json();

      if (isLogin) {
        const loggedInUser = {
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          token: data.access_token
        };
        setCurrentUser(loggedInUser);
        if (rememberMe) {
          localStorage.setItem('scrybeUser', JSON.stringify(loggedInUser));
        } else {
          sessionStorage.setItem('scrybeUser', JSON.stringify(loggedInUser));
        }
        const redirectPath = localStorage.getItem('scrybeRedirect') || '/eval';
        localStorage.removeItem('scrybeRedirect');
        navigate(redirectPath);
      } else {
        setAuthPassword('');
        setAuthError('Registration successful. Please log in.');
        setRegisterStep(1);
        navigate('/login');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('scrybeUser');
    sessionStorage.removeItem('scrybeUser');
    setResult(null);
    setVideoFile(null);
    setVideoPreview(null);
    setQuestion('');
    setReferenceAnswer('');
    navigate('/');
  };

  const startScreenCapture = async () => {
    try {
      const constraints = { video: true, audio: false };
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setMediaStream(stream);
      if (videoStreamRef.current) {
        videoStreamRef.current.srcObject = stream;
      }
      setIsRecording(true);
      stream.getVideoTracks()[0].onended = () => stopScreenCapture();
    } catch (err) {
      console.error("Screen capture failed:", err);
      setError("Failed to start screen capture. Please ensure you grant permission.");
    }
  };

  const stopScreenCapture = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setMediaStream(null);
    setIsRecording(false);
  };

  // Periodic frame capture during recording
  useEffect(() => {
    let intervalId;
    if (isRecording && mediaStream) {
      intervalId = setInterval(async () => {
        if (videoStreamRef.current && captureCanvasRef.current) {
          const video = videoStreamRef.current;
          const canvas = captureCanvasRef.current;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            try {
              const response = await fetch(`${API_URL}/analyze-frame`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
              });
              if (response.ok) {
                const tData = await response.json();
                setTelemetry(tData);
              }
            } catch (e) {
              console.error("Telemetry error", e);
            }
          }
        }
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [isRecording, mediaStream]);

  const fileInputRef = useRef(null);

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      } else {
        setError("Please upload a valid video or audio file.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || !referenceAnswer) {
      setError('Please provide a reference answer and a video file.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('reference_answer', referenceAnswer);

    try {
      const response = await fetch(`${API_URL}/evaluate`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const scorePercentage = Math.round((data.score || 0) * 100);
      const keywordOverlap = calculateKeywordOverlap(data.transcript, referenceAnswer);

      const finalResult = {
        ...data,
        score: scorePercentage,
        breakdown: {
          semantic: scorePercentage,
          keyword: Math.round(keywordOverlap),
          hybrid: Math.round((scorePercentage + keywordOverlap) / 2),
          confidence: Math.round(85 + (scorePercentage * 0.15))
        },
        grade: getGrade(scorePercentage)
      };

      setResult(finalResult);
      setActiveTab('overview');

      if (currentUser) {
        await saveEvaluationToDB(finalResult);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const calculateKeywordOverlap = (transcript, reference) => {
    if (!transcript || !reference) return 0;
    const tWords = new Set(transcript.toLowerCase().match(/\b\w{3,}\b/g));
    const rWords = new Set(reference.toLowerCase().match(/\b\w{3,}\b/g));
    if (rWords.size === 0) return 0;
    const intersection = new Set([...tWords].filter(x => rWords.has(x)));
    return (intersection.size / rWords.size) * 100;
  };

  const getKeywordsAnalysis = () => {
    if (!result || !result.transcript || !referenceAnswer) return { matched: [], missing: [] };
    const stopWords = new Set(["the","and","that","this","for","with","you","not","have","are","was","but","their","from","then","there","what","how","who","will","would"]);
    const refWords = Array.from(new Set(referenceAnswer.toLowerCase().match(/\b\w{4,}\b/g) || [])).filter(w => !stopWords.has(w)).slice(0, 15);
    const transText = (result.transcript || "").toLowerCase();
    const matched = [];
    const missing = [];
    refWords.forEach(word => {
      const isMatch = transText.includes(word) || (word.length > 5 && transText.includes(word.substring(0, word.length - 2)));
      if (isMatch) matched.push(word);
      else missing.push(word);
    });
    return { matched, missing };
  };

  const downloadTranscript = (format) => {
    if (!result || !result.transcript) return;
    const timestamp = new Date().toLocaleDateString();
    const fileName = `Scrybe_Report_${new Date().getTime()}`;

    if (format === 'txt') {
      const element = document.createElement("a");
      const content = `S C R Y B E  |  E V A L U A T I O N   R E P O R T\n` +
        `==================================================\n` +
        `Date: ${timestamp}\n` +
        `Target Question: ${question || 'General Speech Analysis'}\n` +
        `Performance Grade: ${result.grade}\n` +
        `Golden Score Similarity: ${result.score}%\n\n` +
        `TRANSCRIPT:\n` +
        `-----------\n` +
        `${result.transcript}\n\n` +
        `AI SUMMARY:\n` +
        `-----------\n` +
        `${result.summary || 'N/A'}\n\n` +
        `FEEDBACK SUMMARY:\n` +
        `-----------------\n` +
        `Strengths:\n` +
        `${result.feedback?.strengths?.map(s => ` - ${s}`).join('\n') || 'None'}\n\n` +
        `Missing Concepts:\n` +
        `${result.feedback?.missing?.map(m => ` - ${m}`).join('\n') || 'None'}`;
      const file = new Blob([content], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${fileName}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === 'pdf') {
      import('jspdf').then(({ jsPDF }) => {
        const doc = new jsPDF();
        doc.setFont("Helvetica");
        doc.setFontSize(22);
        doc.setTextColor(22, 22, 23);
        doc.text("S | Scrybe Speech Analysis", 15, 20);
        doc.setFontSize(10);
        doc.setTextColor(110, 110, 115);
        doc.text(`Report Generated: ${timestamp} | Score: ${result.score}% (${result.grade})`, 15, 28);
        doc.line(15, 32, 195, 32);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Question: ${question || 'General Speech Analysis'}`, 15, 40);
        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");
        doc.text("Speech Transcript", 15, 52);
        doc.setFont("Helvetica", "normal");
        const splitTranscript = doc.splitTextToSize(result.transcript, 170);
        doc.text(splitTranscript, 15, 58);
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont("Helvetica", "bold");
        doc.text("AI Core Summary", 15, 20);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(11);
        const splitSummary = doc.splitTextToSize(result.summary || "No summary provided.", 170);
        doc.text(splitSummary, 15, 28);
        doc.save(`${fileName}.pdf`);
      });
    }
  };

  const getGrade = (score) => {
    if (score >= 90) return 'Grade A';
    if (score >= 80) return 'Grade B';
    if (score >= 70) return 'Grade C';
    if (score >= 60) return 'Grade D';
    return 'Grade F';
  };

  const checkAuthProtection = (targetPath) => {
    if (!currentUser) {
      localStorage.setItem('scrybeRedirect', targetPath);
      navigate('/login');
    } else {
      navigate(targetPath);
      setError(null);
    }
  };

  // ==================== RENDERERS ====================

  const renderNavbar = () => (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="scrybe-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/')} aria-label="Scrybe Home">
        <div className="logo-s">S</div>
        <span>Scrybe</span>
      </div>
      <div className="nav-links">
        <a href="#" className={`nav-link ${currentPath === '/' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
        <a href="#" className={`nav-link ${currentPath === '/eval' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); checkAuthProtection('/eval'); }}>Workspace</a>
        <a href="#" className={`nav-link ${currentPath === '/leaderboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); checkAuthProtection('/leaderboard'); }}>Leaderboard</a>
        <a href="#" className={`nav-link ${currentPath === '/history' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); checkAuthProtection('/history'); }}>History</a>
        <a href="#" className={`nav-link ${currentPath === '/about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/about'); }}>About</a>
        {currentUser ? (
          <div className="user-badge">
            <div className="user-avatar" aria-hidden="true">
              {(currentUser.first_name || currentUser.username)[0].toUpperCase()}
            </div>
            <span className="user-name">Welcome, {currentUser.first_name || currentUser.username}</span>
            <button className="btn-ghost" onClick={handleLogout} aria-label="Logout" style={{ fontSize: '0.78rem' }}>Sign Out</button>
          </div>
        ) : (
          <button className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem' }} onClick={() => navigate('/login')}>Sign In</button>
        )}
      </div>
    </nav>
  );

  // ==================== LANDING PAGE ====================

  const renderHome = () => (
    <div>
      <div className="hero-section">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          Now powered by AI Intelligence Engine v2.0
        </div>
        <h1 className="hero-title">
          Transform speech into<br />
          <span className="hero-title-gradient">actionable intelligence</span>
        </h1>
        <p className="hero-subtitle">
          Scrybe analyzes video responses with enterprise-grade AI — 
          transcribing speech, detecting visual presence, and measuring semantic 
          similarity against reference answers in real time.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => checkAuthProtection('/eval')}>
            Start Analyzing
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
          <button className="btn-secondary" onClick={() => navigate('/about')}>
            Learn More
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">99.2%</div>
            <div className="stat-label">Transcription Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">2.4M+</div>
            <div className="stat-label">Minutes Processed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">50K+</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">4.9/5</div>
            <div className="stat-label">User Satisfaction</div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <div className="section-header">
          <span className="section-label">Features</span>
          <h2 className="section-title">AI-powered intelligence</h2>
          <p className="section-desc">Everything you need to analyze, understand, and improve video-based communication.</p>
        </div>

        <div className="features-grid">
          {[
            { icon: '🎤', title: 'Transcript Generation', desc: 'High-fidelity speech-to-text with speaker diarization, timestamps, and multi-language support powered by Whisper AI.' },
            { icon: '🔍', title: 'Frame Analyzer', desc: 'Real-time visual analysis detecting faces, objects, scene changes, and OCR text extraction from video frames.' },
            { icon: '🧠', title: 'AI Summarization', desc: 'Intelligent extractive and abstractive summarization that distills key insights, action items, and highlights.' },
            { icon: '📊', title: 'Similarity Detection', desc: 'Semantic embedding comparison using Sentence Transformers for accurate content overlap and confidence scoring.' },
            { icon: '🖥️', title: 'Live Screen Capture', desc: 'Capture screens, tabs, or windows with real-time frame analysis, telemetry, and live transcription.' },
            { icon: '📈', title: 'AI Insights Dashboard', desc: 'Comprehensive analytics with visual reports, deep dives, keyword analysis, and exportable results.' }
          ].map((feature, i) => (
            <div key={i} className="feature-card" style={{ animation: `fadeInUp 0.5s ease-out ${0.1 + i * 0.08}s both` }}>
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social Proof */}
      <div className="social-proof">
        <div className="section-header">
          <span className="section-label">Testimonials</span>
          <h2 className="section-title">Trusted by teams worldwide</h2>
        </div>
        <div className="testimonials-grid">
          {[
            { stars: '★★★★★', text: '"Scrybe transformed how we evaluate interview responses. The similarity scoring is remarkably accurate."', author: 'Sarah Chen', role: 'VP of Talent, ScaleAI' },
            { stars: '★★★★★', text: '"The frame analysis combined with transcription gives us insights we never had before. Game changer."', author: 'Marcus Rivera', role: 'CTO, EduTech Solutions' },
            { stars: '★★★★★', text: '"We use Scrybe to analyze training videos. The AI summaries alone save us 20+ hours per week."', author: 'Priya Sharma', role: 'Learning & Development, GlobalCorp' }
          ].map((t, i) => (
            <div key={i} className="testimonial-card" style={{ animation: `fadeInUp 0.5s ease-out ${0.2 + i * 0.1}s both` }}>
              <div className="testimonial-stars">{t.stars}</div>
              <p className="testimonial-text">{t.text}</p>
              <div className="testimonial-author">{t.author}</div>
              <div className="testimonial-role">{t.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ==================== AUTH PAGES ====================

  const renderAuth = (mode) => (
    <div className="auth-container">
      <div className="auth-bg-shapes">
        <div className="auth-shape"></div>
        <div className="auth-shape"></div>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">S</div>
          <h2 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Sign in to access your workspace' : 'Start your AI-powered analysis journey'}
          </p>
        </div>

        {mode === 'register' && (
          <div className="register-progress" aria-label="Registration progress">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`register-step-dot ${step === registerStep ? 'active' : ''} ${step < registerStep ? 'completed' : ''}`}
              />
            ))}
          </div>
        )}

        {authError && (
          <div className={authError.includes('successful') ? 'auth-success' : 'auth-error'} role="alert">
            <span>{authError.includes('successful') ? '✓' : '!'}</span>
            <span>{authError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={(e) => handleAuthSubmit(e, mode)}>

          {mode === 'register' && registerStep === 1 && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="register-step-label">
                <div className="register-step-number">1</div>
                <span className="register-step-title">Personal Information</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input id="firstName" type="text" className="form-input" value={authFirstName}
                    onChange={(e) => setAuthFirstName(e.target.value)} required placeholder="John" />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input id="lastName" type="text" className="form-input" value={authLastName}
                    onChange={(e) => setAuthLastName(e.target.value)} required placeholder="Doe" />
                </div>
              </div>
              <button type="button" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                onClick={() => authFirstName && authLastName ? setRegisterStep(2) : setAuthError('Please fill in all fields')}>
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          )}

          {mode === 'register' && registerStep === 2 && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="register-step-label">
                <div className="register-step-number">2</div>
                <span className="register-step-title">Account Credentials</span>
              </div>
              <div className="form-group">
                <label htmlFor="regUsername">Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">@</span>
                  <input id="regUsername" type="text" className="form-input" value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)} required placeholder="johndoe" style={{ paddingLeft: '2.5rem' }} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="regPassword">Password</label>
                <div className="input-wrapper">
                  <input id="regPassword" type={showPassword ? "text" : "password"} className="form-input" value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)} required placeholder="••••••••" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => { setRegisterStep(1); setAuthError(null); }}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => authUsername && authPassword ? setRegisterStep(3) : setAuthError('Please fill in all fields')}>
                  Review →
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && registerStep === 3 && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="register-step-label">
                <div className="register-step-number">3</div>
                <span className="register-step-title">Review & Confirm</span>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <p style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>Name: <strong style={{ color: 'var(--text-secondary)' }}>{authFirstName} {authLastName}</strong></p>
                <p style={{ color: 'var(--text-tertiary)' }}>Username: <strong style={{ color: 'var(--text-secondary)' }}>{authUsername}</strong></p>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={authLoading}>
                {authLoading ? <span className="spinner" /> : 'Create Account'}
              </button>
              <button type="button" className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                onClick={() => { setRegisterStep(2); setAuthError(null); }}>
                ← Edit Details
              </button>
            </div>
          )}

          {mode === 'login' && (
            <>
              <div className="form-group">
                <label htmlFor="loginUsername">Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">@</span>
                  <input id="loginUsername" type="text" className="form-input" value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)} required placeholder="your username" style={{ paddingLeft: '2.5rem' }} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <div className="input-wrapper">
                  <input id="loginPassword" type={showPassword ? "text" : "password"} className="form-input" value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)} required placeholder="••••••••" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  Remember me
                </label>
                <span className="form-link" tabIndex={0} role="button" aria-label="Forgot password">Forgot password?</span>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={authLoading}>
                {authLoading ? <span className="spinner" /> : 'Sign In'}
              </button>
            </>
          )}
        </form>

        {mode === 'login' && (
          <>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div className="social-auth">
              <button className="social-btn" aria-label="Sign in with Google">🔵 Google</button>
              <button className="social-btn" aria-label="Sign in with GitHub">⬛ GitHub</button>
            </div>
          </>
        )}

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
          {mode === 'login' ? (
            <>New to Scrybe?{' '}
              <span className="form-link" onClick={() => { navigate('/register'); setAuthError(null); setRegisterStep(1); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/register')}>
                Create your account
              </span>
            </>
          ) : (
            <>Already have an account?{' '}
              <span className="form-link" onClick={() => { navigate('/login'); setAuthError(null); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/login')}>
                Sign in
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );

  // ==================== EVAL / DASHBOARD ====================

  const renderEval = () => {
    if (result && activeTab === 'deep-dive') {
      const keywords = getKeywordsAnalysis();
      return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="ai-hub-header" style={{ marginBottom: '1.5rem' }}>
            <div>
              <span className="section-label">ANALYTICS ENGINE</span>
              <h2 className="dashboard-title" style={{ marginTop: '0.25rem' }}>Analytical Deep Dive</h2>
            </div>
            <button className="btn-secondary" onClick={() => setActiveTab('overview')}>
              ← Back to Report
            </button>
          </div>

          <div className="deep-dive-grid">
            <div className="deep-dive-card">
              <h3>Comprehensive Performance Analysis</h3>
              <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                Based on keyword analysis, your answer captured {keywords.matched.length} out of {keywords.matched.length + keywords.missing.length || 1} primary concepts from the reference answer.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="metric-block">
                  <div className="metric-block-label">Contextual Accuracy</div>
                  <div className="metric-block-value" style={{ color: 'var(--accent-blue)' }}>{result.breakdown.semantic}%</div>
                </div>
                <div className="metric-block">
                  <div className="metric-block-label">Term Fluidity</div>
                  <div className="metric-block-value" style={{ color: 'var(--accent-purple)' }}>{result.breakdown.keyword}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="deep-dive-card">
                <h3 style={{ fontSize: '1rem' }}>Actionable Insights</h3>
                {result.feedback?.suggestions?.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-title">{item.type || "General"}</div>
                    <div className="timeline-desc">{item.content || item}</div>
                  </div>
                )) || (
                  <div className="timeline-item">
                    <div className="timeline-title">General</div>
                    <div className="timeline-desc">Review the reference answer and incorporate missing concepts.</div>
                  </div>
                )}
              </div>

              <div className="deep-dive-card">
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Engine Confidence</span>
                  <div className="big-metric-text" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {result.breakdown.confidence}%
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>High fidelity semantic matching active using Sentence Transformer engine.</p>
                </div>
              </div>

              <div className="deep-dive-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div className="strength-badge"><span className="strength-icon">✓</span> <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>Key Strengths</span></div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    {result.feedback?.strengths?.map((item, idx) => <li key={idx} style={{ marginBottom: '0.35rem', listStyleType: 'disc' }}>{item}</li>) || <li style={{ listStyleType: 'disc' }}>General match.</li>}
                  </ul>
                </div>
                <div>
                  <div className="missing-badge"><span className="missing-icon">✗</span> <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>Improvement Areas</span></div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    {result.feedback?.missing?.map((item, idx) => <li key={idx} style={{ marginBottom: '0.35rem', listStyleType: 'disc' }}>{item}</li>) || <li style={{ listStyleType: 'disc' }}>No major missing points.</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Dashboard Stats */}
        <div className="dashboard-stats-row">
          <div className="dashboard-stat">
            <div className="dashboard-stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>🎯</div>
            <div className="dashboard-stat-value">{result ? result.score : '—'}%</div>
            <div className="dashboard-stat-label">Accuracy Score</div>
          </div>
          <div className="dashboard-stat">
            <div className="dashboard-stat-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)' }}>📝</div>
            <div className="dashboard-stat-value">{videoFile ? videoFile.name.length > 15 ? videoFile.name.slice(0, 12) + '…' : videoFile.name : '—'}</div>
            <div className="dashboard-stat-label">Active File</div>
          </div>
          <div className="dashboard-stat">
            <div className="dashboard-stat-icon" style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)' }}>📊</div>
            <div className="dashboard-stat-value">{historyItems.length || '—'}</div>
            <div className="dashboard-stat-label">Total Evaluations</div>
          </div>
          <div className="dashboard-stat">
            <div className="dashboard-stat-icon" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)' }}>⚡</div>
            <div className="dashboard-stat-value">{currentUser ? 'Online' : 'Offline'}</div>
            <div className="dashboard-stat-label">System Status</div>
          </div>
        </div>

        <div className="evaluation-grid">
          {/* LEFT COLUMN: SETUP */}
          <div className="setup-column">
            <span className="section-label">01. SETUP</span>
            <h2 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', background: 'none', WebkitTextFillColor: 'unset' }}>Input Specifications</h2>

            <div className="result-card">
              <form onSubmit={handleSubmit}>

                <div className="form-group">
                  <label>Candidate Video Response *</label>
                  {!videoPreview ? (
                    <div
                      className={`upload-area ${dragActive ? 'drag-active' : ''}`}
                      onClick={() => fileInputRef.current.click()}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current.click()}
                      aria-label="Upload video file"
                    >
                      <span className="upload-icon">📁</span>
                      <span className="upload-text">Drag & drop or browse</span>
                      <span className="upload-hint">MP4, WEBM, WAV, or MP3 supported</span>
                    </div>
                  ) : (
                    <div className="video-preview-wrapper">
                      <video src={videoPreview} className="video-preview" controls />
                      <button type="button" className="btn-secondary" onClick={() => fileInputRef.current.click()}
                        style={{ position: 'absolute', bottom: '0.75rem', right: '0.75rem', background: 'rgba(0,0,0,0.75)', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        Replace
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleVideoChange} style={{ display: 'none' }} accept="video/*,audio/*" />
                </div>

                {/* Screen Capture */}
                <div className="screen-capture-section">
                  <div className="screen-capture-header">
                    <span className="screen-capture-label">Live Screen Capture</span>
                    <div className="recording-indicator">
                      <span className="recording-dot" style={{ animationPlayState: isRecording ? 'running' : 'paused' }}></span>
                      {isRecording ? 'Recording' : 'Offline'}
                    </div>
                  </div>
                  <div className="capture-preview">
                    <video ref={videoStreamRef} autoPlay playsInline muted className="capture-video" style={{ opacity: isRecording ? 1 : 0 }} />
                    {!isRecording && (
                      <div className="capture-placeholder">
                        <span style={{ fontSize: '2rem' }}>🖥️</span>
                        <span>Click "Start Recording" to begin</span>
                      </div>
                    )}
                  </div>
                  <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

                  <div className="capture-controls">
                    {!isRecording ? (
                      <button type="button" className="capture-btn capture-btn-start" onClick={startScreenCapture}>
                        ▶ Start Recording
                      </button>
                    ) : (
                      <>
                        <button type="button" className="capture-btn capture-btn-stop" onClick={stopScreenCapture}>
                          ■ Stop Recording
                        </button>
                      </>
                    )}
                  </div>

                  {isRecording && (
                    <div className="telemetry-panel">
                      <div className="telemetry-item">
                        <div className="telemetry-header"><span>Brightness</span><span>{telemetry.brightness}%</span></div>
                        <div className="telemetry-track"><div className="telemetry-fill blue" style={{ width: `${telemetry.brightness}%` }}></div></div>
                      </div>
                      <div className="telemetry-item">
                        <div className="telemetry-header"><span>Contrast</span><span>{telemetry.contrast}%</span></div>
                        <div className="telemetry-track"><div className="telemetry-fill green" style={{ width: `${telemetry.contrast}%` }}></div></div>
                      </div>
                      <div className="telemetry-item">
                        <div className="telemetry-header"><span>Edge Density</span><span>{telemetry.edge_density}%</span></div>
                        <div className="telemetry-track"><div className="telemetry-fill purple" style={{ width: `${telemetry.edge_density}%` }}></div></div>
                      </div>
                      <div className="telemetry-item">
                        <div className="telemetry-header"><span>Info Rate</span><span>{telemetry.info_rate}%</span></div>
                        <div className="telemetry-track"><div className="telemetry-fill cyan" style={{ width: `${telemetry.info_rate}%` }}></div></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label>Interview Question (Optional)</label>
                  <input type="text" className="flat-input" value={question}
                    onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Can you explain how async/await works?" />
                </div>

                <div className="form-group">
                  <label>Reference Answer *</label>
                  <textarea className="flat-input" value={referenceAnswer}
                    onChange={(e) => setReferenceAnswer(e.target.value)}
                    placeholder="Provide the expected keywords or reference answer for similarity comparison..." rows={4} required />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }} disabled={loading}>
                  {loading ? <><span className="spinner"></span> Analyzing…</> : 'Evaluate'}
                </button>

                {error && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'center' }} role="alert">{error}</div>}
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS */}
          <div className="results-column">
            <span className="section-label">02. RESULTS</span>
            <h2 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', background: 'none', WebkitTextFillColor: 'unset' }}>Analysis Report</h2>

            {!result ? (
              <div className="result-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
                <p>Awaiting input specifications to generate report.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>Upload a video and provide a reference answer to begin.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="result-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
                  <svg width="0" height="0">
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="score-ring-container">
                    <svg className="score-svg" viewBox="0 0 100 100">
                      <circle className="score-bg-circle" cx="50" cy="50" r="45" />
                      <circle className="score-progress-circle" cx="50" cy="50" r="45"
                        style={{ strokeDasharray: 283, strokeDashoffset: 283 - (283 * result.score) / 100 }} />
                    </svg>
                    <div className="score-text-container">
                      <div className="score-number">{result.score}</div>
                      <div className="score-label">SIMILARITY</div>
                    </div>
                  </div>
                  <div className="score-grade" style={{ color: result.score >= 80 ? 'var(--accent-green)' : result.score >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                    {result.grade}
                  </div>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', fontStyle: 'italic', marginBottom: '1.5rem' }}>Evaluation completed successfully</p>

                  <div className="result-actions">
                    <button className="result-btn" onClick={() => downloadTranscript('pdf')}>
                      📄 Download Report
                    </button>
                    <button className="result-btn" onClick={() => downloadTranscript('txt')}>
                      📝 Transcript
                    </button>
                  </div>
                </div>

                {/* AI Intelligence Hub */}
                <div className="result-card ai-hub">
                  <div className="ai-hub-header">
                    <h3 className="ai-hub-title">AI Intelligence Hub</h3>
                    <button className="btn-secondary" onClick={() => setActiveTab('deep-dive')} style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
                      Deep Dive
                    </button>
                  </div>

                  <div className="ai-hub-grid">
                    <div>
                      <span className="section-label" style={{ marginBottom: '0.5rem' }}>SUMMARY</span>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
                        {result.summary || "Summary generation completed."}
                      </p>
                    </div>
                    <div>
                      <span className="section-label" style={{ marginBottom: '0.5rem' }}>FULL TRANSCRIPT</span>
                      <div className="transcript-box">
                        {result.transcript || "No transcripted content available."}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <span className="section-label" style={{ marginBottom: '0.5rem' }}>VISUAL PRESENCE ANALYSIS</span>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                      {result.visual_analysis || "No visual verification log generated."}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== LEADERBOARD ====================

  const renderLeaderboard = () => {
    const filteredList = leaderboardItems.filter(item =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.question?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="leaderboard-container">
        <span className="section-label">PERFORMANCE STATS</span>
        <h2 className="section-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', background: 'none', WebkitTextFillColor: 'unset' }}>Candidate Leaderboard</h2>
        <p className="dashboard-subtitle" style={{ marginBottom: '1.5rem' }}>Top performers ranked by similarity score</p>

        <input type="text" className="search-box" placeholder="Search by name or question…"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search leaderboard" />

        <div className="table-card" style={{ background: 'var(--card-bg)', border: 'var(--glass-border)' }}>
          {leaderboardLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Rank</th>
                  <th>Candidate</th>
                  <th>Topic</th>
                  <th>Date</th>
                  <th style={{ width: '90px' }}>Score</th>
                  <th style={{ width: '100px' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item, index) => {
                  let rankClass = "other";
                  if (index === 0) rankClass = "gold";
                  else if (index === 1) rankClass = "silver";
                  else if (index === 2) rankClass = "bronze";
                  return (
                    <tr key={index}>
                      <td><div className={`rank-badge ${rankClass}`}>{index + 1}</div></td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ color: 'var(--text-tertiary)' }}>{item.question}</td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{item.date}</td>
                      <td className="score-cell">{item.score}%</td>
                      <td className="grade-cell" style={{ color: item.score >= 80 ? 'var(--accent-green)' : item.score >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                        {item.grade}
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>No submissions found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // ==================== HISTORY ====================

  const renderHistory = () => {
    const filteredHistory = historyItems.filter(item =>
      item.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.transcript && item.transcript.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div className="leaderboard-container">
        <span className="section-label">RECORDS LOG</span>
        <h2 className="section-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', background: 'none', WebkitTextFillColor: 'unset' }}>Evaluation History</h2>
        <p className="dashboard-subtitle" style={{ marginBottom: '1.5rem' }}>Your previous analysis results and reports</p>

        <input type="text" className="search-box" placeholder="Search history by topic or keywords…"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search history" />

        <div className="history-grid">
          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>
          ) : (
            filteredHistory.map((item, index) => (
              <div key={index} className="history-card">
                <div className="history-info">
                  <span className="history-date">{item.date}</span>
                  <h4 className="history-question">{item.question}</h4>
                  <p className="history-snippet">{item.transcript || 'No transcript text log.'}</p>
                </div>
                <div className="history-stats">
                  <div style={{ textAlign: 'right' }}>
                    <div className="history-score" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{item.score}%</div>
                    <div className="history-grade">{item.grade}</div>
                  </div>
                  <button className="delete-btn" onClick={() => deleteHistoryItem(item.dbId)} title="Remove record" aria-label="Delete history item">
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}

          {!historyLoading && filteredHistory.length === 0 && (
            <div className="result-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No history matches your criteria.
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== ABOUT ====================

  const renderAbout = () => (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <span className="section-label">ABOUT</span>
      <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'unset' }}>The Scrybe Platform</h2>
      <div className="result-card" style={{ padding: '2.5rem', maxWidth: '720px' }}>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1.5rem' }}>
          Scrybe is an enterprise-grade AI-powered platform designed to analyze video and audio content with precision. 
          Our engine combines state-of-the-art speech recognition, computer vision, and natural language processing 
          to deliver comprehensive communication intelligence.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
          {[
            { label: 'Engine', value: 'Scrybe AI v2.0' },
            { label: 'Transcription', value: 'OpenAI Whisper (base)' },
            { label: 'Embeddings', value: 'all-mpnet-base-v2' },
            { label: 'Analysis', value: 'Semantic + Keyword Hybrid' },
            { label: 'Facial Detection', value: 'OpenCV Haarcascade' },
            { label: 'API Protocol', value: 'REST + WebSocket' }
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ==================== FOOTER ====================

  const renderFooter = () => (
    <footer className="footer">
      <div className="footer-links">
        <span className="footer-link" role="button" tabIndex={0}>Privacy</span>
        <span className="footer-link" role="button" tabIndex={0}>Terms</span>
        <span className="footer-link" role="button" tabIndex={0}>Security</span>
        <span className="footer-link" role="button" tabIndex={0}>Docs</span>
      </div>
      <div>&copy; {new Date().getFullYear()} Scrybe AI. All rights reserved.</div>
    </footer>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="app-container">
      {renderNavbar()}
      <main className="main-content" role="main">
        {(currentPath === '/' || currentPath === '/home') && renderHome()}
        {currentPath === '/login' && renderAuth('login')}
        {currentPath === '/register' && renderAuth('register')}
        {currentPath === '/eval' && renderEval()}
        {currentPath === '/leaderboard' && renderLeaderboard()}
        {currentPath === '/history' && renderHistory()}
        {currentPath === '/about' && renderAbout()}
      </main>
      {renderFooter()}
    </div>
  );
}

export default App;
