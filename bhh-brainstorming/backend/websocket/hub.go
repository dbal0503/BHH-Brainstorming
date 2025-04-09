package websocket

import (
	"bhh-brainstorming/backend/models"
	"encoding/json"
	"log"
	"sync"
)

type Hub struct {
	sessions       *models.SessionManager
	clients        map[*Client]bool
	clientSessions map[*Client]string
	register       chan *Client
	unregister     chan *Client
	broadcast      chan []byte
	mutex          sync.RWMutex
}

type Message struct {
	Type      string      `json:"type"`
	SessionID string      `json:"sessionId,omitempty"`
	UserID    string      `json:"userId,omitempty"`
	Username  string      `json:"username,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

func NewHub() *Hub {
	return &Hub{
		sessions:       models.NewSessionManager(),
		clients:        make(map[*Client]bool),
		clientSessions: make(map[*Client]string),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		broadcast:      make(chan []byte),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				if sessionID, inSession := h.clientSessions[client]; inSession {
					if session, err := h.sessions.GetSession(sessionID); err == nil {
						session.RemoveUser(client.userID)
						h.notifySessionUpdate(sessionID)

						if len(session.GetUsers()) == 0 {
							h.sessions.RemoveSession(sessionID)
						}
					}
					delete(h.clientSessions, client)
				}

				delete(h.clients, client)
				close(client.send)
			}
			h.mutex.Unlock()
		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) HandleMessage(client *Client, rawMessage []byte) {
	var message Message
	if err := json.Unmarshal(rawMessage, &message); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return
	}

	switch message.Type {
	case "create_session":
		h.handleCreateSession(client, message)
	case "join_session":
		h.handleJoinSession(client, message)
	case "leave_session":
		h.handleLeaveSession(client)
	case "list_sessions":
		h.handleListSessions(client)
	case "session_message":
		h.handleSessionMessage(client, message)
	}
}

func (h *Hub) handleCreateSession(client *Client, message Message) {
	if name, ok := message.Data.(string); ok {
		user := models.User{
			ID:       client.userID,
			Username: message.Username,
		}

		session := h.sessions.CreateSession(name, user)

		h.mutex.Lock()
		h.clientSessions[client] = session.ID
		h.mutex.Unlock()

		response, _ := json.Marshal(Message{
			Type: "session_created",
			Data: session,
		})
		client.send <- response

		h.broadcastSessionsList()
	}
}

func (h *Hub) handleJoinSession(client *Client, message Message) {
	session, err := h.sessions.GetSession(message.SessionID)
	if err != nil {
		response, _ := json.Marshal(Message{
			Type: "error",
			Data: "Session not found",
		})
		client.send <- response
		return
	}

	user := models.User{
		ID:       client.userID,
		Username: message.Username,
	}

	session.AddUser(user)

	h.mutex.Lock()
	h.clientSessions[client] = session.ID
	h.mutex.Unlock()

	response, _ := json.Marshal(Message{
		Type: "session_joined",
		Data: session,
	})
	client.send <- response

	h.notifySessionUpdate(session.ID)
}

func (h *Hub) notifySessionUpdate(sessionID string) {
	session, err := h.sessions.GetSession(sessionID)
	if err != nil {
		return
	}

	update, _ := json.Marshal(Message{
		Type:      "session_updated",
		SessionID: sessionID,
		Data:      session,
	})

	h.broadcastToSession(sessionID, update)
}

func (h *Hub) handleLeaveSession(client *Client) {
	h.mutex.Lock()
	sessionID, inSession := h.clientSessions[client]
	if inSession {
		delete(h.clientSessions, client)
	}
	h.mutex.Unlock()

	if inSession {
		if session, err := h.sessions.GetSession(sessionID); err == nil {
			session.RemoveUser(client.userID)

			h.notifySessionUpdate(sessionID)

			if len(session.GetUsers()) == 0 {
				h.sessions.RemoveSession(sessionID)
				h.broadcastSessionsList()
			}
		}
	}
}

func (h *Hub) handleListSessions(client *Client) {
	sessions := h.sessions.ListSessions()
	response, _ := json.Marshal(Message{
		Type: "sessions_list",
		Data: sessions,
	})
	client.send <- response
}

func (h *Hub) handleSessionMessage(client *Client, message Message) {
	h.mutex.RLock()
	sessionID, inSession := h.clientSessions[client]
	h.mutex.RUnlock()

	if !inSession || sessionID != message.SessionID {
		return
	}

	messageJSON, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.broadcastToSession(sessionID, messageJSON)
}

func (h *Hub) broadcastSessionsList() {
	sessions := h.sessions.ListSessions()
	message, _ := json.Marshal(Message{
		Type: "sessions_list",
		Data: sessions,
	})

	h.mutex.RLock()
	for client := range h.clients {
		client.send <- message
	}
	h.mutex.RUnlock()
}

func (h *Hub) broadcastToSession(sessionID string, message []byte) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for client, sid := range h.clientSessions {
		if sid == sessionID {
			client.send <- message
		}
	}
}
