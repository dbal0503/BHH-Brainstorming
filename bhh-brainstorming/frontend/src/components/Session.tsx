import React, { useState, useEffect, useRef } from 'react';
import { websocketService, ISession, Message, Idea } from '../services/websocketservice';
import MediaUploader from './MediaUploader';
import MediaDisplay, { AggregationDisplay } from './MediaDisplay';
import './Session.css';

interface Rating {
  novelty: number;
  feasibility: number;
  usefulness: number;
  comment?: string;
}

const Session: React.FC = () => {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [guidingQuestions, setGuidingQuestions] = useState('');
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [aggregatedResult, setAggregatedResult] = useState('');
  const [rating, setRating] = useState<Rating>({ novelty: 1, feasibility: 1, usefulness: 1 });
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [discussionStarted, setDiscussionStarted] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Ref to always hold the latest currentSessionId
  const currentSessionIdRef = useRef(currentSessionId);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const generateUsername = (): string => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let word = '';
    for (let i = 0; i < 5; i++) {
      word += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    const numbers = Math.floor(Math.random() * 900 + 100);
    return word + numbers;
  };

  // Listener to update idea ratings in state when an idea rating message is received.
  const handleIdeaRating = (data: any) => {
    // Expect data to have ideaId and rating info.
    setSessions(prev =>
      prev.map(session =>
        session.id === currentSessionIdRef.current
          ? {
              ...session,
              ideas: session.ideas.map(idea =>
                idea.id === data.ideaId
                  ? { ...idea, ratings: [...idea.ratings, data.rating] }
                  : idea
              ),
            }
          : session
      )
    );
  };

  useEffect(() => {
    setUsername(generateUsername());

    const handleSessionsList = (data: ISession[]) => {
      setSessions(data);
    };

    const handleSessionCreated = (data: ISession) => {
      setCurrentSessionId(data.id);
      setSessions(prev => [data, ...prev.filter(s => s.id !== data.id)]);
    };

    const handleSessionJoined = (data: { id: string }) => {
      setCurrentSessionId(data.id);
    };

    const handleSessionUpdated = (data: ISession) => {
      setSessions(prev => prev.map(s => (s.id === data.id ? data : s)));
    };

    const handleSessionMessage = (data: any) => {
      setChatMessages(prev => [...prev, { type: 'session_message', data }]);
    };

    // When an idea is submitted, update the session's ideas array.
    const handleIdeaSubmitted = (idea: any) => {
      setSessions(prev =>
        prev.map(session =>
          session.id === currentSessionIdRef.current
            ? { ...session, ideas: [...session.ideas, idea] }
            : session
        )
      );
      setChatMessages(prev => [...prev, { type: 'idea_submitted', data: idea }]);
    };

    const handleAggregationStarted = (data: any) => {
      setIsAggregating(true);
      setChatMessages(prev => [...prev, { type: 'aggregation_started', data }]);
    };

    const handleAggregationResult = (data: string) => {
      setAggregatedResult(data);
      setIsAggregating(false);
    };

    const handleAggregationError = (data: any) => {
      setIsAggregating(false);
      setChatMessages(prev => [...prev, { type: 'error', data }]);
    };

    const handleDiscussionStarted = (data: any) => {
      setDiscussionStarted(true);
      setChatMessages(prev => [...prev, { type: 'discussion', data }]);
    };

    websocketService.on('sessions_list', handleSessionsList);
    websocketService.on('session_created', handleSessionCreated);
    websocketService.on('session_joined', handleSessionJoined);
    websocketService.on('session_updated', handleSessionUpdated);
    websocketService.on('session_message', handleSessionMessage);
    websocketService.on('idea_submitted', handleIdeaSubmitted);
    websocketService.on('aggregation_started', handleAggregationStarted);
    websocketService.on('aggregation_result', handleAggregationResult);
    websocketService.on('aggregation_error', handleAggregationError);
    websocketService.on('discussion_started', handleDiscussionStarted);
    websocketService.on('idea_rating', handleIdeaRating);

    return () => {
      websocketService.off('sessions_list', handleSessionsList);
      websocketService.off('session_created', handleSessionCreated);
      websocketService.off('session_joined', handleSessionJoined);
      websocketService.off('session_updated', handleSessionUpdated);
      websocketService.off('session_message', handleSessionMessage);
      websocketService.off('idea_submitted', handleIdeaSubmitted);
      websocketService.off('aggregation_started', handleAggregationStarted);
      websocketService.off('aggregation_result', handleAggregationResult);
      websocketService.off('aggregation_error', handleAggregationError);
      websocketService.off('discussion_started', handleDiscussionStarted);
      websocketService.off('idea_rating', handleIdeaRating);
    };
  }, []);

  const handleConnect = () => {
    if (username.trim() !== '') {
      websocketService.connect(username).then(() => setConnected(true));
    }
  };

  const handleCreateSession = () => {
    if (sessionName.trim() !== '' && guidingQuestions.trim() !== '') {
      const questions = guidingQuestions.split('\n').filter(q => q.trim() !== '');
      websocketService.createSession(sessionName, questions);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    websocketService.joinSession(sessionId);
  };

  const handleLeaveSession = () => {
    if (currentSessionId) {
      websocketService.leaveSession();
      setCurrentSessionId('');
      setAggregatedResult('');
      setDiscussionStarted(false);
      setChatMessages([]);
      setIsAggregating(false);
    }
  };

  const handleSendChat = () => {
    if (currentSessionId && inputMessage.trim() !== '') {
      websocketService.sendSessionMessage(currentSessionId, inputMessage);
      setInputMessage('');
    }
  };

  const handleMediaUploaded = (mediaType: string, mediaURL: string, content: string) => {
    console.log('Media uploaded:', { mediaType, mediaURL, content });
  };


  const handleSubmitRating = (ideaId: string) => {
    if (currentSessionId) {
      websocketService.sendIdeaRating(currentSessionId, ideaId, rating);
      setSelectedIdeaId(null);
      setRating({ novelty: 1, feasibility: 1, usefulness: 1 });
    }
  };

  const handleStartDiscussion = () => {
    if (currentSessionId) {
      websocketService.startDiscussion(currentSessionId);
    }
  };

  const currentSession = sessions.find(session => session.id === currentSessionId);
  const selectedIdea = currentSession?.ideas.find(idea => idea.id === selectedIdeaId);

  // Compute average ratings and collate comments for selected idea.
  let averageNovelty = 0,
    averageFeasibility = 0,
    averageUsefulness = 0;
  let allComments: string[] = [];
  if (selectedIdea && selectedIdea.ratings && selectedIdea.ratings.length > 0) {
    const ratingsArr = selectedIdea.ratings;
    averageNovelty = ratingsArr.reduce((sum, r) => sum + r.novelty, 0) / ratingsArr.length;
    averageFeasibility = ratingsArr.reduce((sum, r) => sum + r.feasibility, 0) / ratingsArr.length;
    averageUsefulness = ratingsArr.reduce((sum, r) => sum + r.usefulness, 0) / ratingsArr.length;
    allComments = ratingsArr
      .filter(r => r.comment && r.comment.trim() !== '')
      .map(r => r.comment as string);
  }

  return (
    <div className="session-container">
      {!connected ? (
        <div className="login-container">
          <h2>Your Generated Username</h2>
          <div className="username-display">{username}</div>
          <div className="joining-actions">
            <button onClick={() => setUsername(generateUsername())}>Re-Generate Username</button>
            <button onClick={handleConnect}>Connect</button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="header">Welcome, {username}</h1>
          {!currentSessionId && (
            <div className="create-session">
              <h2>Create Session</h2>
              <input
                type="text"
                placeholder="Session Name"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                className="session-name-input"
              />
              <textarea
                placeholder="Enter Guiding Questions (one per line)"
                value={guidingQuestions}
                onChange={e => setGuidingQuestions(e.target.value)}
              ></textarea>
              <button onClick={handleCreateSession}>Create Session</button>
            </div>
          )}
          {!currentSessionId && (
            <div className="available-sessions">
              <h2>Available Sessions</h2>
              {sessions.length === 0 ? (
                <p>No sessions available.</p>
              ) : (
                <div className="session-list">
                  <ul>
                    {sessions.map(session => (
                      <li key={session.id}>
                        <span>
                          <strong>{session.name}</strong> (ID: {session.id}) - Created by {session.creator.username}
                        </span>
                        <button onClick={() => handleJoinSession(session.id)}>Join</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {currentSessionId && (
            <>
              <div className="current-session">
                <h2>Current Session</h2>
                <div className="session-info">
                  <p className="session-id-section">
                    ID: <span className="session-id">{currentSessionId}</span>
                  </p>
                  <button className="leave-button" onClick={handleLeaveSession}>
                    Leave Session
                  </button>
                </div>
                {currentSession && (
                  <div className="guiding-questions">
                    <h3>Guiding Questions</h3>
                    <div className="guiding-question-list">
                      {currentSession.guidingQuestions.map((q, idx) => (
                        <div key={idx} className="guiding-question-item">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!discussionStarted && (
                <div className="idea-submission">
                  <h3>Share Your Ideas</h3>
                  <MediaUploader onMediaUploaded={handleMediaUploaded} sessionId={currentSessionId} />
                </div>
              )}
              {currentSession && (
                <div className="ideas-section">
                  <h3>Ideas Shared:</h3>
                  {currentSession.ideas.length > 0 ? (
                    <div className="ideas-list-container">
                      <div className="ideas-list">
                        {currentSession.ideas.map((idea: Idea) => (
                          <div
                            key={idea.id}
                            className="idea-card"
                            onClick={() => setSelectedIdeaId(idea.id)}
                          >
                            <MediaDisplay mediaType={idea.mediaType} mediaURL={idea.mediaURL} content={idea.content} />
                            <div className="vote-hint">
                              {discussionStarted ? "Click to view details" : "Hover & click to vote"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p>No ideas have been submitted yet.</p>
                  )}
                </div>
              )}
              <div className="aggregation-section">
                {isAggregating && (
                  <div className="aggregating-message">
                    <p>Aggregating ideas... This may take a moment.</p>
                  </div>
                )}
                {aggregatedResult && <AggregationDisplay content={aggregatedResult} />}
                {aggregatedResult && !discussionStarted && (
                  <button onClick={handleStartDiscussion} className="start-discussion">
                    Start Group Discussion
                  </button>
                )}
              </div>
              {discussionStarted && (
                <div className="discussion-section">
                  <h3>Group Discussion</h3>
                  <div className="voice-call-bar">
                    <span className="voice-call-label">
                      Voice Call · <span className="voice-call-status">Connected</span>
                    </span>
                    <div className="call-icons">
                      <button
                        className={isMuted ? 'mute-button active' : 'mute-button'}
                        title="Mute"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" strokeWidth="2">
                          <polygon points="5,9 9,9 13,5 13,19 9,15 5,15" />
                          <line x1="16" y1="9" x2="21" y2="14" />
                          <line x1="21" y1="9" x2="16" y2="14" />
                        </svg>
                      </button>
                      <button
                        className={isDeafened ? 'deafen-button active' : 'deafen-button'}
                        title="Deafen"
                        onClick={() => setIsDeafened(!isDeafened)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" strokeWidth="2">
                          <path d="M4 9v6c0 2.21 1.79 4 4 4h2" />
                          <path d="M14 9v6c0 2.21-1.79 4-4 4" />
                          <line x1="18" y1="4" x2="18" y2="20" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="chat-panel">
                    <div className="chat-messages">
                      {chatMessages
                        .filter(msg => msg.type === 'session_message')
                        .map((msg, idx) => (
                          <div key={idx} className="chat-message">
                            <strong>{msg.username || 'Anonymous'}:</strong> {msg.data}
                          </div>
                        ))}
                    </div>
                    <div className="chat-input">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={e => setInputMessage(e.target.value)}
                        placeholder="Type your message..."
                        onKeyPress={e => e.key === 'Enter' && handleSendChat()}
                      />
                      <button onClick={handleSendChat}>Send</button>
                    </div>
                  </div>
                </div>
              )}
              {/* Voting / Details Modal */}
              {selectedIdeaId && (
                <div className="modal-overlay" onClick={() => setSelectedIdeaId(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    {discussionStarted ? (
                      <div className="idea-details">
                        <h3>Idea Details</h3>
                        {selectedIdea ? (
                          <>
                            <div className="rating-summary">
                              <div className="details-bar">
                                <div className="details-bar-inner" style={{ width: `${(averageNovelty/5)*100}%` }}>
                                  Novelty: {averageNovelty.toFixed(1)}
                                </div>
                              </div>
                              <div className="details-bar">
                                <div className="details-bar-inner" style={{ width: `${(averageFeasibility/5)*100}%` }}>
                                  Feasibility: {averageFeasibility.toFixed(1)}
                                </div>
                              </div>
                              <div className="details-bar">
                                <div className="details-bar-inner" style={{ width: `${(averageUsefulness/5)*100}%` }}>
                                  Usefulness: {averageUsefulness.toFixed(1)}
                                </div>
                              </div>
                            </div>
                            <div className="comments-section">
                              <h4>Comments</h4>
                              {allComments.length > 0 ? (
                                <div className="comments-container">
                                  {allComments.map((comment, idx) => (
                                    <p key={idx} className="comment-item">{comment}</p>
                                  ))}
                                </div>
                              ) : (
                                <p className="no-comments">No comments available.</p>
                              )}
                            </div>
                            <button onClick={() => setSelectedIdeaId(null)}>Close</button>
                          </>
                        ) : (
                          <p>Idea not found.</p>
                        )}
                      </div>
                    ) : (
                      <div className="rating-form">
                        <h3>Vote on Idea</h3>
                        <div className="rating-item">
                          <label>Novelty: {rating.novelty}</label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={rating.novelty}
                            onChange={e => setRating({ ...rating, novelty: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="rating-item">
                          <label>Feasibility: {rating.feasibility}</label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={rating.feasibility}
                            onChange={e => setRating({ ...rating, feasibility: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="rating-item">
                          <label>Usefulness: {rating.usefulness}</label>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={rating.usefulness}
                            onChange={e => setRating({ ...rating, usefulness: parseInt(e.target.value) })}
                          />
                        </div>
                        <div className="rating-comment">
                          <label>Comment (optional):</label>
                          <textarea
                            value={rating.comment || ''}
                            onChange={e => setRating({ ...rating, comment: e.target.value })}
                          ></textarea>
                        </div>
                        <div className="modal-actions">
                          <button onClick={() => selectedIdeaId && handleSubmitRating(selectedIdeaId)}>
                            Send Vote
                          </button>
                          <button onClick={() => setSelectedIdeaId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Session;
