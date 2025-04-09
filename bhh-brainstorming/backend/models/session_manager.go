// File: backend/models/session.go
package models

import (
	"errors"
	"math/rand"
	"sync"
	"time"
)

type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type IdeaRating struct {
	UserID    string `json:"userId"`
	Novelty   int    `json:"novelty"`
	Feasibility int  `json:"feasibility"`
	Usefulness int    `json:"usefulness"`
	Comment   string `json:"comment,omitempty"`
}

type Idea struct {
	ID         string       `json:"id"`
	Content    string       `json:"content"`
	MediaType  string       `json:"mediaType"` // e.g. "text", "image", "audio", "video"
	SubmittedBy User        `json:"submittedBy"`
	Ratings    []IdeaRating `json:"ratings"`
}

type Session struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	GuidingQuestions []string         `json:"guidingQuestions"` // provided by team leader
	CreatedAt       time.Time         `json:"createdAt"`
	Creator         User              `json:"creator"`
	Users           map[string]*User  `json:"users"`
	Ideas           []*Idea           `json:"ideas"` // collected idea submissions
	mutex           sync.RWMutex
}

func NewSession(id string, name string, guidingQuestions []string, creator User) *Session {
	return &Session{
		ID:               id,
		Name:             name,
		GuidingQuestions: guidingQuestions,
		CreatedAt:        time.Now(),
		Creator:          creator,
		Users:            map[string]*User{creator.ID: &creator},
		Ideas:            []*Idea{},
	}
}

func (s *Session) AddUser(user User) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.Users[user.ID] = &user
}

func (s *Session) RemoveUser(userID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.Users, userID)
}

func (s *Session) GetUsers() []*User {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	users := make([]*User, 0, len(s.Users))
	for _, user := range s.Users {
		users = append(users, user)
	}
	return users
}

func (s *Session) AddIdea(idea *Idea) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.Ideas = append(s.Ideas, idea)
}

type SessionManager struct {
	sessions map[string]*Session
	mutex    sync.RWMutex
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

func (sm *SessionManager) CreateSession(name string, guidingQuestions []string, creator User) *Session {
	sessionID := generateSessionID()
	session := NewSession(sessionID, name, guidingQuestions, creator)
	sm.mutex.Lock()
	sm.sessions[sessionID] = session
	sm.mutex.Unlock()
	return session
}

func (sm *SessionManager) GetSession(sessionID string) (*Session, error) {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	session, exists := sm.sessions[sessionID]
	if !exists {
		return nil, errors.New("session does not exist")
	}
	return session, nil
}

func (sm *SessionManager) ListSessions() []*Session {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	sessions := make([]*Session, 0, len(sm.sessions))
	for _, session := range sm.sessions {
		sessions = append(sessions, session)
	}
	return sessions
}

func (sm *SessionManager) RemoveSession(sessionID string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	delete(sm.sessions, sessionID)
}

func generateSessionID() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const length = 6
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	sessionID := make([]byte, length)
	for i := range sessionID {
		sessionID[i] = charset[r.Intn(len(charset))]
	}
	return string(sessionID)
}
