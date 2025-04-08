package models

import (
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
