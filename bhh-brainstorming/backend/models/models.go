package models

import (
	"sync"
	"time"
)

type User struct {
	ID string `json:"id"`
	Username string `json:"username"`
}

type Session struct {
	ID string `json:"id"`
	Name string `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Creator User `json:"creator"`
	Users map[string]*User `json:"users"`
	mutex sync.RWMutex
}

func NewSession(id string, name string, creator User) *Session {
	return &Session{
		ID: id,
		Name: name,
		CreatedAt: time.Now(),
		Creator: creator,
		Users: map[string]*User{creator.ID: &creator},
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

