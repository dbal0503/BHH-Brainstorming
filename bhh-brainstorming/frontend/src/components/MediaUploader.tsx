import React, { useState, useRef, ChangeEvent } from 'react';
import { mediaService } from '../services/mediaservice';
import './MediaUploader.css';

interface MediaUploaderProps {
  onMediaUploaded: (mediaType: string, mediaURL: string, content: string) => void;
  sessionId: string;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ onMediaUploaded, sessionId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = {
    'image': ['image/jpeg', 'image/png'],
    'video': ['video/mp4'],
    'audio': ['audio/mpeg', 'audio/wav', 'audio/mp3'],
    'text': ['text/plain']
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) return;
    
    // Check if file type is allowed
    let isAllowed = false;
    for (const typeGroup of Object.values(allowedTypes)) {
      if (typeGroup.includes(file.type)) {
        isAllowed = true;
        break;
      }
    }
    
    if (!isAllowed) {
      setError(`File type ${file.type} is not allowed`);
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images and videos
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else if (file.type.startsWith('audio/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSubmit = async () => {
    if (!content && !selectedFile) {
      setError('Please provide content or select a file');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      await mediaService.submitIdeaWithMedia(sessionId, content, selectedFile || undefined);
      
      // Reset form
      setContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="media-uploader">
      <h3>Submit Your Idea</h3>
      
      <div className="input-group">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Type your idea here..."
          disabled={isUploading}
        />
      </div>
      
      <div className="input-group">
        <label htmlFor="file-upload">Add media (optional):</label>
        <input
          type="file"
          id="file-upload"
          onChange={handleFileChange}
          disabled={isUploading}
          ref={fileInputRef}
          accept=".jpg,.jpeg,.png,.mp4,.mp3,.wav,.txt"
        />
      </div>
      
      {previewUrl && (
        <div className="preview-container">
          {selectedFile?.type.startsWith('image/') && (
            <img src={previewUrl} alt="Preview" className="media-preview" />
          )}
          {selectedFile?.type.startsWith('video/') && (
            <video src={previewUrl} controls className="media-preview" />
          )}
          {selectedFile?.type.startsWith('audio/') && (
            <audio src={previewUrl} controls className="media-preview" />
          )}
          <button 
            type="button" 
            onClick={handleReset} 
            className="reset-button"
            disabled={isUploading}
          >
            Remove
          </button>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="button-group">
        <button 
          onClick={handleSubmit} 
          disabled={isUploading || (!content && !selectedFile)}
          className="submit-button"
        >
          {isUploading ? 'Uploading...' : 'Submit Idea'}
        </button>
      </div>
    </div>
  );
};

export default MediaUploader; 