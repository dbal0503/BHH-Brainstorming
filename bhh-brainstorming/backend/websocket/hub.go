// File: backend/websocket/hub.go
package websocket

import (
	"bhh-brainstorming/backend/models"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"strconv"
)

type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	send    chan []byte
	userID  string
	Username string
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(60 * time.Second)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}
		c.hub.HandleMessage(c, message)
	}
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Println("Error writing message:", err)
				return
			}
		}
	}
}

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
	case "idea_submission":
		h.handleIdeaSubmission(client, message)
	case "aggregate_ideas":
		h.handleAggregateIdeas(client, message)
	case "idea_rating":
		h.handleIdeaRating(client, message)
	case "start_discussion":
		h.handleStartDiscussion(client, message)
	}
}

func (h *Hub) handleCreateSession(client *Client, message Message) {
	// Expect Data to be a JSON object with "name" (string) and "guidingQuestions" ([]string)
	dataMap, ok := message.Data.(map[string]interface{})
	if !ok {
		log.Println("Invalid data format for session creation")
		response, _ := json.Marshal(Message{
			Type: "error",
			Data: "Invalid session creation data",
		})
		client.send <- response
		return
	}
	name, nameOk := dataMap["name"].(string)
	gqInterface, gqOk := dataMap["guidingQuestions"].([]interface{})
	if !nameOk || name == "" || !gqOk {
		log.Println("Missing session name or guiding questions")
		response, _ := json.Marshal(Message{
			Type: "error",
			Data: "Session name and guiding questions are required",
		})
		client.send <- response
		return
	}
	guidingQuestions := []string{}
	for _, q := range gqInterface {
		if qs, ok := q.(string); ok {
			guidingQuestions = append(guidingQuestions, qs)
		}
	}
	user := models.User{
		ID:       client.userID,
		Username: message.Username,
	}
	session := h.sessions.CreateSession(name, guidingQuestions, user)
	log.Printf("Session created: %+v", session)
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

func (h *Hub) handleIdeaSubmission(client *Client, message Message) {
	h.mutex.RLock()
	sessionID, inSession := h.clientSessions[client]
	h.mutex.RUnlock()
	if !inSession || sessionID != message.SessionID {
		return
	}

	// Expect Data to be an object with "content" and optional "mediaType"
	dataMap, ok := message.Data.(map[string]interface{})
	if !ok {
		log.Println("Invalid data for idea submission")
		return
	}
	content, contentOk := dataMap["content"].(string)
	mediaType, mtOk := dataMap["mediaType"].(string)
	if !contentOk || content == "" {
		log.Println("Idea content is required")
		return
	}
	if !mtOk {
		mediaType = "text"
	}
	idea := &models.Idea{
		ID:         generateSessionID(), // reuse session ID generator for idea IDs
		Content:    content,
		MediaType:  mediaType,
		SubmittedBy: models.User{ID: client.userID, Username: message.Username},
		Ratings:    []models.IdeaRating{},
	}
	session, err := h.sessions.GetSession(sessionID)
	if err != nil {
		return
	}
	session.AddIdea(idea)
	response, _ := json.Marshal(Message{
		Type: "idea_submitted",
		Data: idea,
	})
	h.broadcastToSession(sessionID, response)
}

func (h *Hub) handleAggregateIdeas(client *Client, message Message) {
	h.mutex.RLock()
	sessionID, inSession := h.clientSessions[client]
	h.mutex.RUnlock()
	if !inSession || sessionID != message.SessionID {
		return
	}
	session, err := h.sessions.GetSession(sessionID)
	if err != nil {
		return
	}
	// Dummy aggregation: combine all idea contents
	agg := "Aggregated Ideas:\n"
	for _, idea := range session.Ideas {
		agg += "- " + idea.Content + "\n"
	}
	aggregation, _ := json.Marshal(Message{
		Type:      "aggregation_result",
		SessionID: sessionID,
		Data:      agg,
	})
	h.broadcastToSession(sessionID, aggregation)
}

func (h *Hub) handleIdeaRating(client *Client, message Message) {
	h.mutex.RLock()
	sessionID, inSession := h.clientSessions[client]
	h.mutex.RUnlock()
	if !inSession || sessionID != message.SessionID {
		return
	}
	// Broadcast the rating; in a full implementation, you would update the corresponding idea.
	ratingJSON, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling idea rating: %v", err)
		return
	}
	h.broadcastToSession(sessionID, ratingJSON)
}

func (h *Hub) handleStartDiscussion(client *Client, message Message) {
	h.mutex.RLock()
	sessionID, inSession := h.clientSessions[client]
	h.mutex.RUnlock()
	if !inSession || sessionID != message.SessionID {
		return
	}
	discussion, _ := json.Marshal(Message{
		Type:      "discussion_started",
		SessionID: sessionID,
		Data:      "Group discussion phase has started. Please join the chat.",
	})
	h.broadcastToSession(sessionID, discussion)
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

func generateSessionID() string {
	// Simple random ID generation; in a real app, use a more robust method
	return strconv.FormatInt(time.Now().UnixNano(), 10)
}