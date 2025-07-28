import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function TeamPage({ team, user, onBack }) {
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [memberEmail, setMemberEmail] = useState('')
  const [teamMembers, setTeamMembers] = useState([])

  // Fetch current members
  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase
        .from('team_memberships')
        .select('user_id, role, profiles(email)')
        .eq('team_id', team.team_id)

      if (!error) setTeamMembers(data)
    }

    fetchMembers()
  }, [team])

  async function uploadVideo() {
    if (!videoFile) return alert('Please select a file first')

    const fileExt = videoFile.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`

    const { error } = await supabase.storage
      .from('videos')
      .upload(fileName, videoFile, {
        contentType: videoFile.type || 'video/mp4',
      })

    if (error) return alert('Upload failed: ' + error.message)

    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName)

    setVideoUrl(publicUrlData.publicUrl)
    alert('Upload succeeded!')
  }

  async function addMember() {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', memberEmail)

    if (error || users.length === 0) return alert('User not found.')

    const userIdToAdd = users[0].id

    const { error: insertError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: team.team_id,
        user_id: userIdToAdd,
        role: 'player',
      })

    if (insertError) alert('Failed to add: ' + insertError.message)
    else {
      alert('Added!')
      setMemberEmail('')
      // refresh
      const { data } = await supabase
        .from('team_memberships')
        .select('user_id, role, profiles(email)')
        .eq('team_id', team.team_id)
      setTeamMembers(data)
    }
  }

  async function removeMember() {
    const match = teamMembers.find((m) =>
      m.profiles.email.toLowerCase() === memberEmail.toLowerCase()
    )
    if (!match) return alert('No such member.')

    const { error } = await supabase
      .from('team_memberships')
      .delete()
      .match({ team_id: team.team_id, user_id: match.user_id })

    if (error) alert('Failed to remove: ' + error.message)
    else {
      alert('Removed.')
      setMemberEmail('')
      setTeamMembers((prev) =>
        prev.filter((m) => m.user_id !== match.user_id)
      )
    }
  }

  const suggested = teamMembers
    .filter((m) =>
      m.profiles.email.toLowerCase().includes(memberEmail.toLowerCase())
    )
    .map((m) => m.profiles.email)

  return (
    <div>
      <h2>{team.teams.name}</h2>
      <button onClick={onBack}>← Back to Dashboard</button>

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
      <input
        type="file"
        accept=".mp4,.mov"
        onChange={(e) => setVideoFile(e.target.files[0])}
      />
      <button onClick={uploadVideo}>Upload Video</button>

      {videoUrl && <video controls width="480" src={videoUrl}></video>}
    </div>
  )
}

export default TeamPage
