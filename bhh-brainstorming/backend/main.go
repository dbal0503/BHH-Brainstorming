package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/cors"

	"bhh-brainstorming/backend/handlers"
	"bhh-brainstorming/backend/services"
	"bhh-brainstorming/backend/websocket"
)

func main() {
	
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: Error loading .env file:", err)
	}

	
	openAIKey := os.Getenv("OPENAI_API_KEY")
	if openAIKey == "" {
		log.Println("Warning: OPENAI_API_KEY environment variable not set. Media aggregation will not work.")
	}

	
	openAIService := services.NewOpenAIService(openAIKey)
	mediaProcessor := services.NewMediaProcessor(openAIService)

	
	hub := websocket.NewHub()
	hub.SetMediaProcessor(mediaProcessor)
	go hub.Run()

	
	mux := http.NewServeMux()

	
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "message": "Server is running"}`))
	})

	
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(hub, w, r)
	})

	
	mux.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir("./media"))))
	mux.HandleFunc("/api/upload", handlers.UploadMediaHandler)

	
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000", "https://bhh-brainstorming-production-d38d.up.railway.app"}, 
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders:   []string{"*"}, 
		AllowCredentials: true,
	})

	
	handler := corsMiddleware.Handler(mux)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatal("Server error:", err)
	}
}
