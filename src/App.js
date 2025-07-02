import { useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) alert(error.message)
    else alert('Check your email for confirmation link.')
  }

  async function signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) alert(error.message)
    else setUser(data.user)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <main>
      <h1>VolleyStat</h1>

      {!user ? (
        <div>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={signIn}>Log In</button>
          <button onClick={signUp}>Sign Up</button>
        </div>
      ) : (
        <div>
          <p>Logged in as {user.email}</p>
          <button onClick={signOut}>Log Out</button>
        </div>
      )}
    </main>
  )
}

export default App
