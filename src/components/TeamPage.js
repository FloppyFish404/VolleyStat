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

  // Video upload handler
  function uploadVideo(file) {
    if (!file) {
      alert('Please select a file first.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const upload = new tus.Upload(file, {
      endpoint: `https://video.bunnycdn.com/library/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID}/videos`,
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_BUNNY_API_KEY}`,
      },
      chunkSize: 5 * 1024 * 1024, // 5MB
      onError: (error) => {
        console.error('Upload failed:', error);
        setUploading(false);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setUploadProgress(Number(percentage));
      },
      onSuccess: () => {
        console.log('Upload finished:', upload.url);
        // You would normally retrieve Bunny's video ID from API response here
        setVideoUrl(URL.createObjectURL(file)); // TEMP: local preview
        setUploading(false);
      },
    });

    uploadRef.current = upload;
    upload.start();
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
    </div>
  );
}
