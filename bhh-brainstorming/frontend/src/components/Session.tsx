// src/components/Session.tsx
import React, { useState, useEffect } from 'react';
import { websocketService, Session as SessionType, Message } from '../services/websocketservice';

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
      setMessages((prev) => [...prev, { type: 'session_message', data: data }]);
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
    <div style={{ padding: '20px' }}>
      {!connected ? (
        <div>
          <h2>Enter Username</h2>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={handleConnect}>Connect</button>
        </div>
      ) : (
        <>
          <h1>BHH-Brainstorming Frontend</h1>
          <div style={{ margin: '20px 0' }}>
            <h2>Create Session</h2>
            <input
              placeholder="Session Name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
            <button onClick={handleCreateSession}>Create Session</button>
          </div>
          <div style={{ margin: '20px 0' }}>
            <h2>Available Sessions</h2>
            {sessions.length === 0 && <p>No sessions available.</p>}
            <ul>
              {sessions.map((session) => (
                <li key={session.id}>
                  <strong>{session.name}</strong> (ID: {session.id}) - Created by {session.creator.username}
                  <button onClick={() => handleJoinSession(session.id)}>Join</button>
                </li>
              ))}
            </ul>
          </div>
          {currentSessionId && (
            <div style={{ margin: '20px 0' }}>
              <h2>Session Chat (Session ID: {currentSessionId})</h2>
              <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll' }}>
                {messages.map((msg, index) => (
                  <div key={index}>
                    <strong>{msg.username ? `${msg.username}: ` : ''}</strong>
                    <span>{msg.data}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px' }}>
                <input
                  style={{ width: '80%' }}
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
