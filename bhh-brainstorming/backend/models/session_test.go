package models

import (
	"testing"
)

func TestNewSession(t *testing.T) {
	// Create a test user
	creator := User{
		ID:       "test-user-id",
		Username: "testuser",
	}

	// Create a new session
	sessionName := "Test Session"
	session := NewSession("test-session-id", sessionName, creator)

	// Verify session was created correctly
	if session.ID != "test-session-id" {
		t.Errorf("Expected session ID to be 'test-session-id', got '%s'", session.ID)
	}

	if session.Name != sessionName {
		t.Errorf("Expected session name to be '%s', got '%s'", sessionName, session.Name)
	}

	if session.Creator.ID != creator.ID {
		t.Errorf("Expected creator ID to be '%s', got '%s'", creator.ID, session.Creator.ID)
	}

	// Check that creator was added to users map
	if len(session.Users) != 1 {
		t.Errorf("Expected users map to have 1 entry, got %d", len(session.Users))
	}

	if user, exists := session.Users[creator.ID]; !exists || user.Username != creator.Username {
		t.Errorf("Creator not properly added to users map")
	}
}

func TestAddUser(t *testing.T) {
	// Create a test session
	creator := User{ID: "creator-id", Username: "creator"}
	session := NewSession("test-session", "Test Session", creator)

	// Add a new user
	newUser := User{ID: "user-id", Username: "testuser"}
	session.AddUser(newUser)

	// Check if the user was added correctly
	if len(session.Users) != 2 {
		t.Errorf("Expected users map to have 2 entries, got %d", len(session.Users))
	}

	if user, exists := session.Users[newUser.ID]; !exists || user.Username != newUser.Username {
		t.Errorf("User not properly added to users map")
	}
}

func TestRemoveUser(t *testing.T) {
	// Create a test session with two users
	creator := User{ID: "creator-id", Username: "creator"}
	session := NewSession("test-session", "Test Session", creator)

	newUser := User{ID: "user-id", Username: "testuser"}
	session.AddUser(newUser)

	// Verify both users are in the session
	if len(session.Users) != 2 {
		t.Errorf("Expected users map to have 2 entries, got %d", len(session.Users))
	}

	// Remove the second user
	session.RemoveUser(newUser.ID)

	// Check if the user was removed correctly
	if len(session.Users) != 1 {
		t.Errorf("Expected users map to have 1 entry after removal, got %d", len(session.Users))
	}

	if _, exists := session.Users[newUser.ID]; exists {
		t.Errorf("User not properly removed from users map")
	}

	// Creator should still be in the map
	if _, exists := session.Users[creator.ID]; !exists {
		t.Errorf("Creator unexpectedly removed from users map")
	}
}
