-- ============================================================
-- Scrybe AI Platform - SQLite Database Schema (local dev fallback)
-- Mirrors schema_mysql.sql. Enable with: DB_ENGINE=sqlite
-- ============================================================

-- ============================================================
-- ENUMS / LOOKUP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS UserRoles (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE,
    Description TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO UserRoles (Id, Name, Description) VALUES
    (1, 'admin', 'Full system access'),
    (2, 'analyst', 'Can create evaluations and view results'),
    (3, 'viewer', 'Read-only access to results');

CREATE TABLE IF NOT EXISTS SubscriptionTiers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE,
    MaxProjects INTEGER NOT NULL DEFAULT 10,
    MaxVideoSizeMB INTEGER NOT NULL DEFAULT 500,
    DailyApiCalls INTEGER NOT NULL DEFAULT 100,
    HasRealTimeProcessing INTEGER NOT NULL DEFAULT 0,
    HasBatchProcessing INTEGER NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO SubscriptionTiers (Id, Name, MaxProjects, MaxVideoSizeMB, DailyApiCalls, HasRealTimeProcessing, HasBatchProcessing) VALUES
    (1, 'free', 3, 100, 10, 0, 0),
    (2, 'pro', 25, 1000, 500, 1, 0),
    (3, 'enterprise', 9999, 5000, 99999, 1, 1);

CREATE TABLE IF NOT EXISTS ProcessingStatus (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO ProcessingStatus (Id, Name) VALUES
    (1, 'pending'), (2, 'processing'), (3, 'completed'), (4, 'failed'), (5, 'cancelled');

CREATE TABLE IF NOT EXISTS NotificationTypes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO NotificationTypes (Id, Name) VALUES
    (1, 'evaluation_complete'), (2, 'processing_error'), (3, 'system_alert'), (4, 'welcome');

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    FirstName TEXT,
    LastName TEXT,
    Email TEXT,
    AvatarUrl TEXT,
    RoleId INTEGER NOT NULL DEFAULT 2,
    SubscriptionTierId INTEGER NOT NULL DEFAULT 1,
    IsActive INTEGER NOT NULL DEFAULT 1,
    EmailVerified INTEGER NOT NULL DEFAULT 0,
    LastLoginAt DATETIME,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId) REFERENCES UserRoles(Id),
    CONSTRAINT FK_Users_SubscriptionTier FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id)
);

CREATE INDEX IF NOT EXISTS IX_Users_Username ON Users (Username);
CREATE INDEX IF NOT EXISTS IX_Users_Email ON Users (Email);
CREATE INDEX IF NOT EXISTS IX_Users_RoleId ON Users (RoleId);

CREATE TABLE IF NOT EXISTS UserSessions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    AccessToken TEXT NOT NULL,
    RefreshToken TEXT NOT NULL UNIQUE,
    IpAddress TEXT,
    UserAgent TEXT,
    IsActive INTEGER NOT NULL DEFAULT 1,
    ExpiresAt DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    RevokedAt DATETIME,
    CONSTRAINT FK_UserSessions_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_UserSessions_UserId ON UserSessions (UserId);
CREATE INDEX IF NOT EXISTS IX_UserSessions_RefreshToken ON UserSessions (RefreshToken);

CREATE TABLE IF NOT EXISTS Projects (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    Name TEXT NOT NULL,
    Description TEXT,
    IsArchived INTEGER NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Projects_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_Projects_UserId ON Projects (UserId);
CREATE INDEX IF NOT EXISTS IX_Projects_CreatedAt ON Projects (CreatedAt DESC);

CREATE TABLE IF NOT EXISTS Videos (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    FileName TEXT NOT NULL,
    FilePath TEXT NOT NULL,
    FileSizeBytes INTEGER NOT NULL DEFAULT 0,
    DurationSeconds REAL,
    MimeType TEXT,
    StatusId INTEGER NOT NULL DEFAULT 1,
    ErrorMessage TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Videos_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Videos_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Videos_Status FOREIGN KEY (StatusId) REFERENCES ProcessingStatus(Id)
);

CREATE INDEX IF NOT EXISTS IX_Videos_ProjectId ON Videos (ProjectId);
CREATE INDEX IF NOT EXISTS IX_Videos_UserId ON Videos (UserId);
CREATE INDEX IF NOT EXISTS IX_Videos_StatusId ON Videos (StatusId);

CREATE TABLE IF NOT EXISTS Transcripts (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    VideoId INTEGER NOT NULL,
    ProjectId INTEGER NOT NULL,
    FullText TEXT NOT NULL,
    Language TEXT DEFAULT 'en',
    WordCount INTEGER NOT NULL DEFAULT 0,
    ConfidenceScore REAL,
    ProcessingTimeMs INTEGER,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Transcripts_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Transcripts_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IF NOT EXISTS IX_Transcripts_VideoId ON Transcripts (VideoId);

CREATE TABLE IF NOT EXISTS TranscriptSegments (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    TranscriptId INTEGER NOT NULL,
    SpeakerLabel TEXT,
    StartTime REAL NOT NULL,
    EndTime REAL NOT NULL,
    Text TEXT NOT NULL,
    Confidence REAL,
    SegmentOrder INTEGER NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_TranscriptSegments_Transcript FOREIGN KEY (TranscriptId) REFERENCES Transcripts(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_TranscriptSegments_TranscriptId ON TranscriptSegments (TranscriptId);

CREATE TABLE IF NOT EXISTS FrameAnalysis (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    VideoId INTEGER NOT NULL,
    ProjectId INTEGER NOT NULL,
    FrameTimestamp REAL NOT NULL,
    FramePath TEXT,
    FaceCount INTEGER DEFAULT 0,
    Brightness REAL,
    Contrast REAL,
    EdgeDensity REAL,
    OcrText TEXT,
    SceneLabel TEXT,
    ObjectLabels TEXT,
    ActivityLabel TEXT,
    ContextDescription TEXT,
    AnalysisData TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_FrameAnalysis_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_FrameAnalysis_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IF NOT EXISTS IX_FrameAnalysis_VideoId ON FrameAnalysis (VideoId);

CREATE TABLE IF NOT EXISTS Summaries (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    VideoId INTEGER NOT NULL,
    ProjectId INTEGER NOT NULL,
    QuickSummary TEXT,
    DetailedSummary TEXT,
    KeyInsights TEXT,
    ActionItems TEXT,
    Highlights TEXT,
    ConfidenceScore REAL,
    ModelVersion TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Summaries_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Summaries_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IF NOT EXISTS IX_Summaries_VideoId ON Summaries (VideoId);

CREATE TABLE IF NOT EXISTS SimilarityResults (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    VideoId INTEGER NOT NULL,
    ProjectId INTEGER NOT NULL,
    ReferenceAnswer TEXT NOT NULL,
    SemanticScore REAL NOT NULL DEFAULT 0,
    KeywordScore REAL NOT NULL DEFAULT 0,
    HybridScore REAL NOT NULL DEFAULT 0,
    ConfidenceScore REAL NOT NULL DEFAULT 0,
    MatchedKeywords TEXT,
    MissingKeywords TEXT,
    OverlapPercentage REAL,
    Grade TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SimilarityResults_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SimilarityResults_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IF NOT EXISTS IX_SimilarityResults_VideoId ON SimilarityResults (VideoId);
CREATE INDEX IF NOT EXISTS IX_SimilarityResults_Score ON SimilarityResults (HybridScore DESC);

CREATE TABLE IF NOT EXISTS ActivityLogs (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    ActionType TEXT NOT NULL,
    EntityType TEXT,
    EntityId INTEGER,
    Metadata TEXT,
    IpAddress TEXT,
    UserAgent TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ActivityLogs_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_ActivityLogs_UserId ON ActivityLogs (UserId);
CREATE INDEX IF NOT EXISTS IX_ActivityLogs_ActionType ON ActivityLogs (ActionType);
CREATE INDEX IF NOT EXISTS IX_ActivityLogs_CreatedAt ON ActivityLogs (CreatedAt DESC);

CREATE TABLE IF NOT EXISTS Notifications (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    TypeId INTEGER NOT NULL,
    Title TEXT NOT NULL,
    Message TEXT,
    Link TEXT,
    IsRead INTEGER NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Notifications_Type FOREIGN KEY (TypeId) REFERENCES NotificationTypes(Id)
);

CREATE INDEX IF NOT EXISTS IX_Notifications_UserId ON Notifications (UserId);

CREATE TABLE IF NOT EXISTS Settings (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    SettingKey TEXT NOT NULL,
    SettingValue TEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Settings_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_Settings_UserKey UNIQUE (UserId, SettingKey)
);

CREATE INDEX IF NOT EXISTS IX_Settings_UserId ON Settings (UserId);

-- Extra table required by notes feature in app.py
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Notes_User FOREIGN KEY (user_id) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Extra table required by queries feature in app.py
CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    question_id INTEGER,
    source TEXT NOT NULL DEFAULT 'practice',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Queries_User FOREIGN KEY (user_id) REFERENCES Users(Id) ON DELETE CASCADE
);

-- ============================================================
-- QUESTION LIBRARY (Section 1.1)
-- Curated practice questions with AI model answers and key
-- concepts. org_id is NULL for the public library; non-NULL for
-- org/role-specific custom banks (reuses the same data model).
-- ============================================================

CREATE TABLE IF NOT EXISTS question_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    model_answer TEXT NOT NULL DEFAULT '',
    key_concepts TEXT NOT NULL DEFAULT '[]',
    org_id INTEGER,
    created_by INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS IX_QuestionBank_Category ON question_bank (category);
CREATE INDEX IF NOT EXISTS IX_QuestionBank_OrgId ON question_bank (org_id);

-- ============================================================
-- INVITE LINKS (Section 1.4)
-- Shareable no-signup links that let a coach/recruiter send a
-- question set to a candidate and have the result land back in
-- the sender's dashboard automatically.
-- ============================================================

CREATE TABLE IF NOT EXISTS invite_links (
    token TEXT PRIMARY KEY,
    question_set_id INTEGER,
    sender_id INTEGER NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    reference_answer TEXT NOT NULL DEFAULT '',
    expires_at DATETIME NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_InviteLinks_Question FOREIGN KEY (question_set_id) REFERENCES question_bank(id) ON DELETE SET NULL,
    CONSTRAINT FK_InviteLinks_Sender FOREIGN KEY (sender_id) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_InviteLinks_Sender ON invite_links (sender_id);
CREATE INDEX IF NOT EXISTS IX_InviteLinks_Expires ON invite_links (expires_at);
