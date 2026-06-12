-- ============================================================
-- Scrybe AI Platform - MySQL Database Schema
-- Version: 2.0.0
-- ============================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS ScrybeDB;
USE ScrybeDB;

-- ============================================================
-- ENUMS / LOOKUP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS UserRoles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(50) NOT NULL UNIQUE,
    Description VARCHAR(255),
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO UserRoles (Name, Description) VALUES
    ('admin', 'Full system access'),
    ('analyst', 'Can create evaluations and view results'),
    ('viewer', 'Read-only access to results');

CREATE TABLE IF NOT EXISTS SubscriptionTiers (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(50) NOT NULL UNIQUE,
    MaxProjects INT NOT NULL DEFAULT 10,
    MaxVideoSizeMB INT NOT NULL DEFAULT 500,
    DailyApiCalls INT NOT NULL DEFAULT 100,
    HasRealTimeProcessing TINYINT(1) NOT NULL DEFAULT 0,
    HasBatchProcessing TINYINT(1) NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO SubscriptionTiers (Name, MaxProjects, MaxVideoSizeMB, DailyApiCalls, HasRealTimeProcessing, HasBatchProcessing) VALUES
    ('free', 3, 100, 10, 0, 0),
    ('pro', 25, 1000, 500, 1, 0),
    ('enterprise', 9999, 5000, 99999, 1, 1);

CREATE TABLE IF NOT EXISTS ProcessingStatus (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO ProcessingStatus (Name) VALUES
    ('pending'), ('processing'), ('completed'), ('failed'), ('cancelled');

CREATE TABLE IF NOT EXISTS NotificationTypes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO NotificationTypes (Name) VALUES
    ('evaluation_complete'), ('processing_error'), ('system_alert'), ('welcome');

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS Users (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(500) NOT NULL,
    FirstName VARCHAR(255),
    LastName VARCHAR(255),
    Email VARCHAR(255),
    AvatarUrl VARCHAR(500),
    RoleId INT NOT NULL DEFAULT 2,
    SubscriptionTierId INT NOT NULL DEFAULT 1,
    IsActive TINYINT(1) NOT NULL DEFAULT 1,
    EmailVerified TINYINT(1) NOT NULL DEFAULT 0,
    LastLoginAt DATETIME,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId) REFERENCES UserRoles(Id),
    CONSTRAINT FK_Users_SubscriptionTier FOREIGN KEY (SubscriptionTierId) REFERENCES SubscriptionTiers(Id)
);

CREATE INDEX IX_Users_Username ON Users (Username);
CREATE INDEX IX_Users_Email ON Users (Email);
CREATE INDEX IX_Users_RoleId ON Users (RoleId);

CREATE TABLE IF NOT EXISTS UserSessions (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    AccessToken VARCHAR(1000) NOT NULL,
    RefreshToken VARCHAR(500) NOT NULL UNIQUE,
    IpAddress VARCHAR(50),
    UserAgent VARCHAR(500),
    IsActive TINYINT(1) NOT NULL DEFAULT 1,
    ExpiresAt DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    RevokedAt DATETIME,
    CONSTRAINT FK_UserSessions_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_UserSessions_UserId ON UserSessions (UserId);
CREATE INDEX IX_UserSessions_RefreshToken ON UserSessions (RefreshToken);

CREATE TABLE IF NOT EXISTS Projects (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Description VARCHAR(1000),
    IsArchived TINYINT(1) NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Projects_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_Projects_UserId ON Projects (UserId);
CREATE INDEX IX_Projects_CreatedAt ON Projects (CreatedAt DESC);

CREATE TABLE IF NOT EXISTS Videos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProjectId INT NOT NULL,
    UserId INT NOT NULL,
    FileName VARCHAR(500) NOT NULL,
    FilePath VARCHAR(1000) NOT NULL,
    FileSizeBytes BIGINT NOT NULL DEFAULT 0,
    DurationSeconds FLOAT,
    MimeType VARCHAR(100),
    StatusId INT NOT NULL DEFAULT 1,
    ErrorMessage VARCHAR(2000),
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Videos_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Videos_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Videos_Status FOREIGN KEY (StatusId) REFERENCES ProcessingStatus(Id)
);

CREATE INDEX IX_Videos_ProjectId ON Videos (ProjectId);
CREATE INDEX IX_Videos_UserId ON Videos (UserId);
CREATE INDEX IX_Videos_StatusId ON Videos (StatusId);

CREATE TABLE IF NOT EXISTS Transcripts (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    VideoId INT NOT NULL,
    ProjectId INT NOT NULL,
    `FullText` LONGTEXT NOT NULL,
    Language VARCHAR(10) DEFAULT 'en',
    WordCount INT NOT NULL DEFAULT 0,
    ConfidenceScore FLOAT,
    ProcessingTimeMs INT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Transcripts_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Transcripts_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IX_Transcripts_VideoId ON Transcripts (VideoId);

CREATE TABLE IF NOT EXISTS TranscriptSegments (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TranscriptId INT NOT NULL,
    SpeakerLabel VARCHAR(100),
    StartTime FLOAT NOT NULL,
    EndTime FLOAT NOT NULL,
    `Text` LONGTEXT NOT NULL,
    Confidence FLOAT,
    SegmentOrder INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_TranscriptSegments_Transcript FOREIGN KEY (TranscriptId) REFERENCES Transcripts(Id) ON DELETE CASCADE
);

CREATE INDEX IX_TranscriptSegments_TranscriptId ON TranscriptSegments (TranscriptId);

CREATE TABLE IF NOT EXISTS FrameAnalysis (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    VideoId INT NOT NULL,
    ProjectId INT NOT NULL,
    FrameTimestamp FLOAT NOT NULL,
    FramePath VARCHAR(1000),
    FaceCount INT DEFAULT 0,
    Brightness FLOAT,
    Contrast FLOAT,
    EdgeDensity FLOAT,
    OcrText LONGTEXT,
    SceneLabel VARCHAR(255),
    ObjectLabels LONGTEXT,
    ActivityLabel VARCHAR(255),
    ContextDescription LONGTEXT,
    AnalysisData LONGTEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_FrameAnalysis_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_FrameAnalysis_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IX_FrameAnalysis_VideoId ON FrameAnalysis (VideoId);

CREATE TABLE IF NOT EXISTS Summaries (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    VideoId INT NOT NULL,
    ProjectId INT NOT NULL,
    QuickSummary LONGTEXT,
    DetailedSummary LONGTEXT,
    KeyInsights LONGTEXT,
    ActionItems LONGTEXT,
    Highlights LONGTEXT,
    ConfidenceScore FLOAT,
    ModelVersion VARCHAR(50),
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Summaries_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Summaries_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IX_Summaries_VideoId ON Summaries (VideoId);

CREATE TABLE IF NOT EXISTS SimilarityResults (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    VideoId INT NOT NULL,
    ProjectId INT NOT NULL,
    ReferenceAnswer LONGTEXT NOT NULL,
    SemanticScore FLOAT NOT NULL DEFAULT 0,
    KeywordScore FLOAT NOT NULL DEFAULT 0,
    HybridScore FLOAT NOT NULL DEFAULT 0,
    ConfidenceScore FLOAT NOT NULL DEFAULT 0,
    MatchedKeywords LONGTEXT,
    MissingKeywords LONGTEXT,
    OverlapPercentage FLOAT,
    Grade VARCHAR(10),
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_SimilarityResults_Video FOREIGN KEY (VideoId) REFERENCES Videos(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SimilarityResults_Project FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
);

CREATE INDEX IX_SimilarityResults_VideoId ON SimilarityResults (VideoId);
CREATE INDEX IX_SimilarityResults_Score ON SimilarityResults (HybridScore DESC);

CREATE TABLE IF NOT EXISTS ActivityLogs (
    Id BIGINT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    ActionType VARCHAR(100) NOT NULL,
    EntityType VARCHAR(50),
    EntityId INT,
    Metadata LONGTEXT,
    IpAddress VARCHAR(50),
    UserAgent VARCHAR(500),
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_ActivityLogs_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_ActivityLogs_UserId ON ActivityLogs (UserId);
CREATE INDEX IX_ActivityLogs_ActionType ON ActivityLogs (ActionType);
CREATE INDEX IX_ActivityLogs_CreatedAt ON ActivityLogs (CreatedAt DESC);

CREATE TABLE IF NOT EXISTS Notifications (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    TypeId INT NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Message LONGTEXT,
    Link VARCHAR(500),
    IsRead TINYINT(1) NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Notifications_Type FOREIGN KEY (TypeId) REFERENCES NotificationTypes(Id)
);

CREATE INDEX IX_Notifications_UserId ON Notifications (UserId);

CREATE TABLE IF NOT EXISTS Settings (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    SettingKey VARCHAR(255) NOT NULL,
    SettingValue LONGTEXT,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Settings_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_Settings_UserKey UNIQUE (UserId, SettingKey)
);

CREATE INDEX IX_Settings_UserId ON Settings (UserId);

-- Extra table required by notes feature in app.py
CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Notes_User FOREIGN KEY (user_id) REFERENCES Users(Id) ON DELETE CASCADE
);

-- Extra table required by queries feature in app.py
CREATE TABLE IF NOT EXISTS queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    query_text LONGTEXT NOT NULL,
    response_text LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_Queries_User FOREIGN KEY (user_id) REFERENCES Users(Id) ON DELETE CASCADE
);