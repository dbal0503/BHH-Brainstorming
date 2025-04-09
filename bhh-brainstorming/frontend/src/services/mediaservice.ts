import { websocketService } from './websocketservice';

export interface MediaUploadResult {
  url: string;
  mediaType: string;
  filename: string;
}

export class MediaService {
  private apiUrl: string = 'http://localhost:8080';
  
  /**
   * Upload a media file to the server
   * @param file The file to upload
   * @returns Promise with the upload result containing the URL and media type
   */
  async uploadMedia(file: File): Promise<MediaUploadResult> {
    try {
      const formData = new FormData();
      formData.append('media', file);
      
      const response = await fetch(`${this.apiUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result as MediaUploadResult;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }
  
  /**
   * Submit an idea with media attachment to a session
   * @param sessionId The session ID
   * @param content Text content of the idea
   * @param file Optional media file to attach
   */
  async submitIdeaWithMedia(sessionId: string, content: string, file?: File): Promise<void> {
    try {
      // If there's a file, upload it first
      if (file) {
        const uploadResult = await this.uploadMedia(file);
        
        // Then submit the idea with the media URL
        websocketService.sendMessage({
          type: 'idea_submission',
          sessionId: sessionId,
          username: websocketService.getUsername(),
          data: { 
            content, 
            mediaType: uploadResult.mediaType,
            mediaURL: uploadResult.url 
          },
        });
      } else {
        // Just submit the text content
        websocketService.submitIdea(sessionId, content, 'text');
      }
    } catch (error) {
      console.error('Error submitting idea with media:', error);
      throw error;
    }
  }
  
  /**
   * Trigger idea aggregation for a session
   * @param sessionId The session ID
   */
  triggerAggregation(sessionId: string): void {
    websocketService.aggregateIdeas(sessionId);
  }
  
  /**
   * Get the full URL for a media resource
   * @param mediaPath The relative path to the media file
   * @returns The complete URL to the media file
   */
  getMediaUrl(mediaPath: string): string {
    // Handle both absolute and relative paths
    if (mediaPath.startsWith('http')) {
      return mediaPath;
    }
    
    // Make sure the path starts with a slash
    const normalizedPath = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
    return `${this.apiUrl}${normalizedPath}`;
  }
}

export const mediaService = new MediaService(); 