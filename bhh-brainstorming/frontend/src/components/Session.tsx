import React, { useState, useEffect } from 'react';
import { websocketService, Session as SessionType, Message } from '../services/websocketservice';
import './Session.css';

const Session: React.FC = () => {
  const [username, setUsername] = useState('');
  const [connected, setConnected] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    websocketService.on('sessions_list', (data) => {
      setSessions(data);
    });
    websocketService.on('session_created', (data) => {
      setCurrentSessionId(data.id);
      setSessions((prev) => [data, ...prev.filter((s: SessionType) => s.id !== data.id)]);
    });
    websocketService.on('session_joined', (data) => {
      setCurrentSessionId(data.id);
    });
    websocketService.on('session_updated', (data) => {
      setSessions((prev) => prev.map((s: SessionType) => (s.id === data.id ? data : s)));
    });
    websocketService.on('session_message', (data) => {
      setMessages((prev) => [...prev, { type: 'session_message', data }]);
    });

    return () => {
      websocketService.off('sessions_list', () => {});
      websocketService.off('session_created', () => {});
      websocketService.off('session_joined', () => {});
      websocketService.off('session_updated', () => {});
      websocketService.off('session_message', () => {});
    };
  }, []);

  const handleConnect = () => {
    if (username.trim() !== '') {
      websocketService.connect(username).then(() => {
        setConnected(true);
      });
    }
  };

  const handleCreateSession = () => {
    if (sessionName.trim() !== '') {
      websocketService.createSession(sessionName);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    websocketService.joinSession(sessionId);
  };

  const handleSendMessage = () => {
    if (currentSessionId && inputMessage.trim() !== '') {
      websocketService.sendSessionMessage(currentSessionId, inputMessage);
      setInputMessage('');
    }
  };

  return (
    <div className="session-container">
      {!connected ? (
        <div className="login-container">
          <h2>Enter Username</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={handleConnect}>Connect</button>
        </div>
      ) : (
        <>
          <h1 className="header">BHH-Brainstorming Frontend</h1>
          <div className="create-session">
            <h2>Create Session</h2>
            <input
              type="text"
              placeholder="Session Name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
            <button onClick={handleCreateSession}>Create Session</button>
          </div>
          <div className="available-sessions">
            <h2>Available Sessions</h2>
            {sessions.length === 0 && <p>No sessions available.</p>}
            <div className="session-list">
              <ul>
                {sessions.map((session) => (
                  <li key={session.id}>
                    <span>
                      <strong>{session.name}</strong> (ID: {session.id}) - Created by {session.creator.username}
                    </span>
                    <button onClick={() => handleJoinSession(session.id)}>Join</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {currentSessionId && (
            <div className="chat-section">
              <h2>Session Chat (Session ID: {currentSessionId})</h2>
              <div className="chat-container">
                {messages.map((msg, index) => (
                  <div key={index} className="chat-message">
                    <strong>{msg.username ? `${msg.username}: ` : ''}</strong>
                    <span>{msg.data}</span>
                  </div>
                ))}
              </div>
              <div className="chat-input-group">
                <input
                  type="text"
                  placeholder="Type a message"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                />
                <button onClick={handleSendMessage}>Send</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Session;
