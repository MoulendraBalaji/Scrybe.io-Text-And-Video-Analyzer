/* ============================================================
   App — route definitions. The old monolith page (App.jsx/App.css)
   was retired; all UI lives in components/, all pages in pages/.
   ============================================================ */

import { Routes, Route, Navigate } from 'react-router-dom';
import { PageShell } from './components/layout/PageShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Home from './pages/Home';
import Workspace from './pages/Workspace';
import Login from './pages/Login';
import Register from './pages/Register';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import About from './pages/About';
import Profile from './pages/Profile';
import QuestionLibrary from './pages/QuestionLibrary';
import Progress from './pages/Progress';
import Invites from './pages/Invites';
import CandidateInvite from './pages/CandidateInvite';

export default function App() {
  return (
    <Routes>
      <Route element={<PageShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/eval" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/about" element={<About />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/questions" element={<QuestionLibrary />} />
        <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
        <Route path="/invites" element={<ProtectedRoute><Invites /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="/invite/:token" element={<CandidateInvite />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
