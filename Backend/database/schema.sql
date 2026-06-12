-- ============================================================
-- Scrybe AI Platform - Microsoft SQL Server Database Schema
-- Version: 2.0.0
-- Engine: SQL Server 2022+
-- ============================================================

-- Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ScrybeDB')
BEGIN
    CREATE DATABASE ScrybeDB;
END
GO

USE ScrybeDB;
GO

-- ============================================================
-- ENUMS / LOOKUP TABLES
-- ============================================================

CREATE TABLE [dbo].[UserRoles] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Name] NVARCHAR(50) NOT NULL UNIQUE,
    [Description] NVARCHAR(255),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

INSERT INTO [dbo].[UserRoles] ([Name], [Description]) VALUES
    ('admin', 'Full system access'),
    ('analyst', 'Can create evaluations and view results'),
    ('viewer', 'Read-only access to results');
GO

CREATE TABLE [dbo].[SubscriptionTiers] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Name] NVARCHAR(50) NOT NULL UNIQUE,
    [MaxProjects] INT NOT NULL DEFAULT 10,
    [MaxVideoSizeMB] INT NOT NULL DEFAULT 500,
    [DailyApiCalls] INT NOT NULL DEFAULT 100,
    [HasRealTimeProcessing] BIT NOT NULL DEFAULT 0,
    [HasBatchProcessing] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

INSERT INTO [dbo].[SubscriptionTiers] ([Name], [MaxProjects], [MaxVideoSizeMB], [DailyApiCalls], [HasRealTimeProcessing], [HasBatchProcessing]) VALUES
    ('free', 3, 100, 10, 0, 0),
    ('pro', 25, 1000, 500, 1, 0),
    ('enterprise', 9999, 5000, 99999, 1, 1);
GO

CREATE TABLE [dbo].[ProcessingStatus] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Name] NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO [dbo].[ProcessingStatus] ([Name]) VALUES
    ('pending'), ('processing'), ('completed'), ('failed'), ('cancelled');
GO

CREATE TABLE [dbo].[NotificationTypes] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Name] NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO [dbo].[NotificationTypes] ([Name]) VALUES
    ('evaluation_complete'), ('processing_error'), ('system_alert'), ('welcome');
GO

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE [dbo].[Users] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [Username] NVARCHAR(255) NOT NULL UNIQUE,
    [PasswordHash] NVARCHAR(500) NOT NULL,
    [FirstName] NVARCHAR(255),
    [LastName] NVARCHAR(255),
    [Email] NVARCHAR(255),
    [AvatarUrl] NVARCHAR(500),
    [RoleId] INT NOT NULL DEFAULT 2,
    [SubscriptionTierId] INT NOT NULL DEFAULT 1,
    [IsActive] BIT NOT NULL DEFAULT 1,
    [EmailVerified] BIT NOT NULL DEFAULT 0,
    [LastLoginAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Users_Role] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[UserRoles]([Id]),
    CONSTRAINT [FK_Users_SubscriptionTier] FOREIGN KEY ([SubscriptionTierId]) REFERENCES [dbo].[SubscriptionTiers]([Id])
);

CREATE INDEX [IX_Users_Username] ON [dbo].[Users] ([Username]);
CREATE INDEX [IX_Users_Email] ON [dbo].[Users] ([Email]) WHERE [Email] IS NOT NULL;
CREATE INDEX [IX_Users_RoleId] ON [dbo].[Users] ([RoleId]);
GO

CREATE TABLE [dbo].[UserSessions] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [AccessToken] NVARCHAR(1000) NOT NULL,
    [RefreshToken] NVARCHAR(500) NOT NULL UNIQUE,
    [IpAddress] NVARCHAR(50),
    [UserAgent] NVARCHAR(500),
    [IsActive] BIT NOT NULL DEFAULT 1,
    [ExpiresAt] DATETIME2 NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [RevokedAt] DATETIME2,
    CONSTRAINT [FK_UserSessions_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_UserSessions_UserId] ON [dbo].[UserSessions] ([UserId]);
CREATE INDEX [IX_UserSessions_RefreshToken] ON [dbo].[UserSessions] ([RefreshToken]);
GO

CREATE TABLE [dbo].[Projects] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [Name] NVARCHAR(255) NOT NULL,
    [Description] NVARCHAR(1000),
    [IsArchived] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Projects_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_Projects_UserId] ON [dbo].[Projects] ([UserId]);
CREATE INDEX [IX_Projects_CreatedAt] ON [dbo].[Projects] ([CreatedAt] DESC);
GO

CREATE TABLE [dbo].[Videos] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [ProjectId] INT NOT NULL,
    [UserId] INT NOT NULL,
    [FileName] NVARCHAR(500) NOT NULL,
    [FilePath] NVARCHAR(1000) NOT NULL,
    [FileSizeBytes] BIGINT NOT NULL DEFAULT 0,
    [DurationSeconds] FLOAT,
    [MimeType] NVARCHAR(100),
    [StatusId] INT NOT NULL DEFAULT 1,
    [ErrorMessage] NVARCHAR(2000),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Videos_Project] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Videos_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]),
    CONSTRAINT [FK_Videos_Status] FOREIGN KEY ([StatusId]) REFERENCES [dbo].[ProcessingStatus]([Id])
);

CREATE INDEX [IX_Videos_ProjectId] ON [dbo].[Videos] ([ProjectId]);
CREATE INDEX [IX_Videos_UserId] ON [dbo].[Videos] ([UserId]);
CREATE INDEX [IX_Videos_StatusId] ON [dbo].[Videos] ([StatusId]);
GO

CREATE TABLE [dbo].[Transcripts] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VideoId] INT NOT NULL,
    [ProjectId] INT NOT NULL,
    [FullText] NVARCHAR(MAX) NOT NULL,
    [Language] NVARCHAR(10) DEFAULT 'en',
    [WordCount] INT NOT NULL DEFAULT 0,
    [ConfidenceScore] FLOAT,
    [ProcessingTimeMs] INT,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Transcripts_Video] FOREIGN KEY ([VideoId]) REFERENCES [dbo].[Videos]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Transcripts_Project] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id])
);

CREATE INDEX [IX_Transcripts_VideoId] ON [dbo].[Transcripts] ([VideoId]);
GO

CREATE TABLE [dbo].[TranscriptSegments] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [TranscriptId] INT NOT NULL,
    [SpeakerLabel] NVARCHAR(100),
    [StartTime] FLOAT NOT NULL,
    [EndTime] FLOAT NOT NULL,
    [Text] NVARCHAR(MAX) NOT NULL,
    [Confidence] FLOAT,
    [SegmentOrder] INT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_TranscriptSegments_Transcript] FOREIGN KEY ([TranscriptId]) REFERENCES [dbo].[Transcripts]([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_TranscriptSegments_TranscriptId] ON [dbo].[TranscriptSegments] ([TranscriptId]);
GO

CREATE TABLE [dbo].[FrameAnalysis] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VideoId] INT NOT NULL,
    [ProjectId] INT NOT NULL,
    [FrameTimestamp] FLOAT NOT NULL,
    [FramePath] NVARCHAR(1000),
    [FaceCount] INT DEFAULT 0,
    [Brightness] FLOAT,
    [Contrast] FLOAT,
    [EdgeDensity] FLOAT,
    [OcrText] NVARCHAR(MAX),
    [SceneLabel] NVARCHAR(255),
    [ObjectLabels] NVARCHAR(MAX),
    [ActivityLabel] NVARCHAR(255),
    [ContextDescription] NVARCHAR(MAX),
    [AnalysisData] NVARCHAR(MAX),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_FrameAnalysis_Video] FOREIGN KEY ([VideoId]) REFERENCES [dbo].[Videos]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_FrameAnalysis_Project] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id])
);

CREATE INDEX [IX_FrameAnalysis_VideoId] ON [dbo].[FrameAnalysis] ([VideoId]);
GO

CREATE TABLE [dbo].[Summaries] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VideoId] INT NOT NULL,
    [ProjectId] INT NOT NULL,
    [QuickSummary] NVARCHAR(MAX),
    [DetailedSummary] NVARCHAR(MAX),
    [KeyInsights] NVARCHAR(MAX),
    [ActionItems] NVARCHAR(MAX),
    [Highlights] NVARCHAR(MAX),
    [ConfidenceScore] FLOAT,
    [ModelVersion] NVARCHAR(50),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Summaries_Video] FOREIGN KEY ([VideoId]) REFERENCES [dbo].[Videos]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Summaries_Project] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id])
);

CREATE INDEX [IX_Summaries_VideoId] ON [dbo].[Summaries] ([VideoId]);
GO

CREATE TABLE [dbo].[SimilarityResults] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [VideoId] INT NOT NULL,
    [ProjectId] INT NOT NULL,
    [ReferenceAnswer] NVARCHAR(MAX) NOT NULL,
    [SemanticScore] FLOAT NOT NULL DEFAULT 0,
    [KeywordScore] FLOAT NOT NULL DEFAULT 0,
    [HybridScore] FLOAT NOT NULL DEFAULT 0,
    [ConfidenceScore] FLOAT NOT NULL DEFAULT 0,
    [MatchedKeywords] NVARCHAR(MAX),
    [MissingKeywords] NVARCHAR(MAX),
    [OverlapPercentage] FLOAT,
    [Grade] NVARCHAR(10),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_SimilarityResults_Video] FOREIGN KEY ([VideoId]) REFERENCES [dbo].[Videos]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SimilarityResults_Project] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Projects]([Id])
);

CREATE INDEX [IX_SimilarityResults_VideoId] ON [dbo].[SimilarityResults] ([VideoId]);
CREATE INDEX [IX_SimilarityResults_Score] ON [dbo].[SimilarityResults] ([HybridScore] DESC);
GO

CREATE TABLE [dbo].[ActivityLogs] (
    [Id] BIGINT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [ActionType] NVARCHAR(100) NOT NULL,
    [EntityType] NVARCHAR(50),
    [EntityId] INT,
    [Metadata] NVARCHAR(MAX),
    [IpAddress] NVARCHAR(50),
    [UserAgent] NVARCHAR(500),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_ActivityLogs_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_ActivityLogs_UserId] ON [dbo].[ActivityLogs] ([UserId]);
CREATE INDEX [IX_ActivityLogs_ActionType] ON [dbo].[ActivityLogs] ([ActionType]);
CREATE INDEX [IX_ActivityLogs_CreatedAt] ON [dbo].[ActivityLogs] ([CreatedAt] DESC);
GO

CREATE TABLE [dbo].[Notifications] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [TypeId] INT NOT NULL,
    [Title] NVARCHAR(255) NOT NULL,
    [Message] NVARCHAR(MAX),
    [Link] NVARCHAR(500),
    [IsRead] BIT NOT NULL DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Notifications_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Notifications_Type] FOREIGN KEY ([TypeId]) REFERENCES [dbo].[NotificationTypes]([Id])
);

CREATE INDEX [IX_Notifications_UserId] ON [dbo].[Notifications] ([UserId]);
CREATE INDEX [IX_Notifications_Unread] ON [dbo].[Notifications] ([UserId], [IsRead]) WHERE [IsRead] = 0;
GO

CREATE TABLE [dbo].[Settings] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [UserId] INT NOT NULL,
    [SettingKey] NVARCHAR(255) NOT NULL,
    [SettingValue] NVARCHAR(MAX),
    [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_Settings_User] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_Settings_UserKey] UNIQUE ([UserId], [SettingKey])
);

CREATE INDEX [IX_Settings_UserId] ON [dbo].[Settings] ([UserId]);
GO

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

CREATE PROCEDURE [dbo].[sp_GetUserDashboard]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        (SELECT COUNT(*) FROM [dbo].[Projects] WHERE UserId = @UserId AND IsArchived = 0) AS TotalProjects,
        (SELECT COUNT(*) FROM [dbo].[Videos] WHERE UserId = @UserId) AS TotalVideos,
        (SELECT COUNT(*) FROM [dbo].[Transcripts] t
            INNER JOIN [dbo].[Videos] v ON t.VideoId = v.Id
            WHERE v.UserId = @UserId) AS TotalTranscripts,
        (SELECT AVG(sr.HybridScore) FROM [dbo].[SimilarityResults] sr
            INNER JOIN [dbo].[Videos] v ON sr.VideoId = v.Id
            WHERE v.UserId = @UserId) AS AverageScore,
        (SELECT COUNT(*) FROM [dbo].[Notifications] WHERE UserId = @UserId AND IsRead = 0) AS UnreadNotifications,
        (SELECT TOP 5 sr.HybridScore, sr.Grade, sr.CreatedAt, v.FileName
            FROM [dbo].[SimilarityResults] sr
            INNER JOIN [dbo].[Videos] v ON sr.VideoId = v.Id
            WHERE v.UserId = @UserId
            ORDER BY sr.CreatedAt DESC) AS RecentResults
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
END
GO

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER [dbo].[trg_Users_UpdatedAt]
ON [dbo].[Users]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[Users]
    SET [UpdatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Users] u
    INNER JOIN inserted i ON u.Id = i.Id;
END
GO

CREATE TRIGGER [dbo].[trg_Projects_UpdatedAt]
ON [dbo].[Projects]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[Projects]
    SET [UpdatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Projects] p
    INNER JOIN inserted i ON p.Id = i.Id;
END
GO

-- ============================================================
-- DATA RETENTION CLEANUP (Run via SQL Agent Job)
-- ============================================================

CREATE PROCEDURE [dbo].[sp_CleanupOldSessions]
    @DaysRetention INT = 90
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [dbo].[UserSessions]
    WHERE [CreatedAt] < DATEADD(DAY, -@DaysRetention, SYSUTCDATETIME())
    AND [IsActive] = 0;
    
    DELETE FROM [dbo].[ActivityLogs]
    WHERE [CreatedAt] < DATEADD(DAY, -@DaysRetention, SYSUTCDATETIME());
END
GO

PRINT 'ScrybeDB schema v2.0.0 created successfully.';
GO
