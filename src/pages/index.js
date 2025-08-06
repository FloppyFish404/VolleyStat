import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TeamPage from '@/components/TeamPage';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [userTeams, setUserTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for confirmation link.');
  }

  async function signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else setUser(data.user);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function createTeam() {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: newTeamName, created_by: user.id })
      .select()
      .single();

    if (error) {
      alert('Error creating team: ' + error.message);
    } else {
      await supabase.from('team_memberships').insert({
        team_id: data.id,
        user_id: user.id,
        role: 'coach',
      });

      alert(`Team "${newTeamName}" created!`);
      setNewTeamName('');
      fetchTeamsForUser();
    }
  }

  async function fetchTeamsForUser() {
    const { data, error } = await supabase
      .from('team_memberships')
      .select('team_id, teams(name)')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching teams:', error.message);
    } else {
      setUserTeams(data);
    }
  }

  useEffect(() => {
    if (user) {
      fetchTeamsForUser();
    }
  }, [user]);

  return (
    <main>
      <h1>VolleyStat</h1>
      <p>
        A website to support convenient analysis of volleyball team metrics from game footage.
        Supports stat-tracking, event marking, and builds analytical insights across games.
      </p>

      {!user ? (
        <div>
          <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={signIn}>Log In</button>
          <button onClick={signUp}>Sign Up</button>
        </div>
      ) : !selectedTeam ? (
        <div>
          <p>Logged in as {user.email}</p>

          <h3>Your Teams</h3>
          <ul>
            {userTeams.map((entry) => (
              <li
                key={entry.team_id}
                onClick={() => setSelectedTeam(entry)}
                style={{ cursor: 'pointer', color: 'blue' }}
              >
                {entry.teams.name}
              </li>
            ))}
          </ul>

          <h3>Create a Team</h3>
          <input
            type="text"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button onClick={createTeam}>Create Team</button>

          <br />
          <br />
          <button onClick={signOut}>Log Out</button>
        </div>
      ) : (
        <TeamPage team={selectedTeam} user={user} onBack={() => setSelectedTeam(null)} />
      )}
    </main>
  );
}
