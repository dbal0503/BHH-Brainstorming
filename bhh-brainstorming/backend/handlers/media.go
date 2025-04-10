package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const mediaDir = "./media"

var allowedTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"audio/mp3":  true,
	"audio/wav":  true,
	"audio/mpeg": true,
	"video/mp4":  true,
	"text/plain": true,
	"text/link":  true,
}

func UploadMediaHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.ParseMultipartForm(10 << 30) // 30MB max memory

	file, handler, err := r.FormFile("media")
	if err != nil {
		http.Error(w, "Error retrieving media file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := handler.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		http.Error(w, "Invalid file type", http.StatusUnsupportedMediaType)
		return
	}

	if err := os.MkdirAll(mediaDir, os.ModePerm); err != nil {
		http.Error(w, "Failed to create media directory", http.StatusInternalServerError)
		return
	}

	fileExt := filepath.Ext(handler.Filename)
	filename := fmt.Sprintf("%s%s", uuid.New().String(), fileExt)
	filePath := filepath.Join(mediaDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	mediaType := strings.Split(contentType, "/")[0]

	fileURL := fmt.Sprintf("/media/%s", filename)
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(fmt.Sprintf(`{"url": "%s", "mediaType": "%s", "filename": "%s"}`, fileURL, mediaType, filename)))
}
func IsAllowedType(mediaType string) bool {
	if allowedTypes[mediaType] {
		return true
	}

	for fullType := range allowedTypes {
		if strings.HasPrefix(fullType, mediaType+"/") {
			return true
		}
	}

	return false
}
