// File: backend/websocket/client.go
package websocket

import (
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func getRandomUsername() string {
	rand.Seed(time.Now().UnixNano())
	return "User" + strconv.Itoa(rand.Intn(10000))
}

// ServeWs upgrades the HTTP connection and registers the client with the Hub.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading WebSocket:", err)
		return
	}

	userID := r.URL.Query().Get("user")
	if userID == "" {
		userID = getRandomUsername()
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}
