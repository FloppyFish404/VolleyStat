'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as tus from 'tus-js-client';

export default function TeamPage({ team, user, onBack }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [memberEmail, setMemberEmail] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [openVideo, setOpenVideo] = useState(null);

  const uploadRef = useRef(null); // store tus.Upload instance for pause/resume

  // Fetch current members
  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase
        .from('team_memberships')
        .select('user_id, role, profiles(email)')
        .eq('team_id', team.team_id);

      if (!error) setTeamMembers(data);
    }
    fetchMembers();
  }, [team]);


  useEffect(() => {
    loadVideos();
  }, []);


  async function loadVideos() {
    try {
      setLoadingVideos(true);
      const r = await fetch('/api/list-bunny-videos');
      const data = await r.json();
      setVideos(data.items ?? []);
    } finally {
      setLoadingVideos(false);
    }
  }

  async function uploadVideo(file) {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
  
    try {
      setUploading(true);
      setUploadProgress(0);
  
      // 1) Ask our server to create the video + return TUS signature
      const res = await fetch("/api/create-bunny-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: file.name }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create video: ${errText}`);
      }
  
      // Server must return: { tusEndpoint, libraryId, videoId, expires, signature }
      const sig = await res.json();
  
      // 2) Start TUS upload to Bunny
      const upload = new tus.Upload(file, {
        endpoint: sig.tusEndpoint, // "https://video.bunnycdn.com/tusupload"
        headers: {
          AuthorizationSignature: sig.signature,
          AuthorizationExpire: String(sig.expires), // epoch seconds
          LibraryId: sig.libraryId,
          VideoId: sig.videoId,
        },
        metadata: { filename: file.name, filetype: file.type },
        chunkSize: 5 * 1024 * 1024, // 5 MB (optional)
        onError: (error) => {
          console.error("Upload failed:", error);
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(pct);
        },
        onSuccess: () => {
          console.log("Upload finished for video:", sig.videoId);
          // Local preview for now; later swap to Bunny playback URL
          setVideoUrl(URL.createObjectURL(file));
          setUploading(false);
          loadVideos(); // <— refresh the gallery
        },
      });
  
      uploadRef.current = upload;
      upload.start();
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.message);
      setUploading(false);
    }
  }

  function pauseUpload() {
    if (uploadRef.current) {
      uploadRef.current.abort();
    }
  }

  function resumeUpload() {
    if (uploadRef.current) {
      uploadRef.current.start();
    }
  }

  function cancelUpload() {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    const r = await fetch('/api/delete-bunny-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: id }),
    });
    if (r.ok) {
      setVideos(videos.filter(v => v.guid !== id));
    } else {
      alert('Delete failed');
    }
  }

  async function addMember() {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', memberEmail);

    if (error || users.length === 0) return alert('User not found.');

    const userIdToAdd = users[0].id;

    const { error: insertError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: team.team_id,
        user_id: userIdToAdd,
        role: 'player',
      });

    if (insertError) alert('Failed to add: ' + insertError.message);
    else {
      alert('Added!');
      setMemberEmail('');
      const { data } = await supabase
        .from('team_memberships')
        .select('user_id, role, profiles(email)')
        .eq('team_id', team.team_id);
      setTeamMembers(data);
    }
  }

  async function removeMember() {
    const match = teamMembers.find(
      (m) => m.profiles.email.toLowerCase() === memberEmail.toLowerCase()
    );
    if (!match) return alert('No such member.');

    const { error } = await supabase
      .from('team_memberships')
      .delete()
      .match({ team_id: team.team_id, user_id: match.user_id });

    if (error) alert('Failed to remove: ' + error.message);
    else {
      alert('Removed.');
      setMemberEmail('');
      setTeamMembers((prev) => prev.filter((m) => m.user_id !== match.user_id));
    }
  }

  const suggested = teamMembers
    .filter((m) =>
      m.profiles.email.toLowerCase().includes(memberEmail.toLowerCase())
    )
    .map((m) => m.profiles.email);

  return (
    <div>
      <h2>{team.teams.name}</h2>
      <button onClick={onBack}>← Back</button>

      <h4>Team Members</h4>
      <ul>
        {teamMembers.map((m) => (
          <li key={m.user_id}>
            {m.profiles.email} — {m.role}
          </li>
        ))}
      </ul>

      <input
        type="text"
        placeholder="User email"
        value={memberEmail}
        onChange={(e) => setMemberEmail(e.target.value)}
      />
      <button onClick={addMember}>Add Member</button>
      <button onClick={removeMember}>Remove Member</button>

      {memberEmail && suggested.length > 0 && (
        <ul>
          {suggested.map((email) => (
            <li
              key={email}
              onClick={() => setMemberEmail(email)}
              style={{ cursor: 'pointer', color: 'blue' }}
            >
              {email}
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h4>Upload Game Footage</h4>
      <input
        type="file"
        accept=".mp4,.mov"
        onChange={(e) => setVideoFile(e.target.files[0])}
      />
      <div style={{ marginTop: '10px' }}>
        {!uploading ? (
          <button onClick={() => uploadVideo(videoFile)}>Start Upload</button>
        ) : (
          <>
            <progress value={uploadProgress} max="100" />
            <span> {uploadProgress}%</span>
            <div>
              <button onClick={pauseUpload}>Pause</button>
              <button onClick={resumeUpload}>Resume</button>
              <button onClick={cancelUpload}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {videoUrl && (
        <div style={{ marginTop: '20px' }}>
          <video controls width="480" src={videoUrl}></video>
        </div>
      )}

      <hr style={{ marginTop: 20, marginBottom: 10 }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>Team Videos</h4>
        <button onClick={loadVideos} disabled={loadingVideos}>
          {loadingVideos ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      
      {videos.length === 0 && !loadingVideos && (
        <p style={{ color: '#666' }}>No videos yet.</p>
      )}
      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '12px',
          marginTop: '10px',
        }}
      >

      {videos.map((v) => (
        <div key={v.guid} style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.title || '(untitled)'}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v.guid}
            </div>
      
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setOpenVideo(openVideo === v.guid ? null : v.guid)}
                style={{ fontSize: 12, textDecoration: 'underline' }}
              >
                {openVideo === v.guid ? 'Close' : 'Play'}
              </button>
              <button
                onClick={() => deleteVideo(v.guid)}
                style={{ marginLeft: 'auto', fontSize: 12, color: '#c00', textDecoration: 'underline' }}
              >
                Delete
              </button>
            </div>
      
            {openVideo === v.guid && (
              <div style={{ marginTop: 8, position: 'relative', paddingTop: '56.25%' }}>
                <iframe
                  src={v.embedUrl}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  title={v.title || v.guid}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>  
  </div> 
);        
}
