package models

import (
	"errors"
	"math/rand"
	"sync"
	"time"
)

type SessionManager struct {
	sessions map[string]*Session
	mutex    sync.RWMutex
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

func (sm *SessionManager) CreateSession(name string, creator User) *Session {
	sessionID := generateSessionID()

	session := NewSession(sessionID, name, creator)

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
func (sm *SessionManager) RemoveSession(sessiondID string) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	delete(sm.sessions, sessiondID)
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
