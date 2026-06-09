import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../services/firebase'
import { createUserProfile, getUserProfile, goOnline, goOffline } from '../services/firebaseDb'

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  initAuth: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profile = await getUserProfile(firebaseUser.uid)
        if (!profile) {
          profile = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email,
          }
        }
        await goOnline(firebaseUser.uid, profile.displayName)
        set({ user: profile, isAuthenticated: true, loading: false })
      } else {
        set({ user: null, isAuthenticated: false, loading: false })
      }
    })
  },

  register: async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    await createUserProfile(cred.user.uid, email, displayName)
    const profile = { id: cred.user.uid, email, displayName }
    await goOnline(cred.user.uid, displayName)
    set({ user: profile, isAuthenticated: true })
    return profile
  },

  login: async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    let profile = await getUserProfile(cred.user.uid)
    if (!profile) {
      profile = {
        id: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email,
      }
    }
    await goOnline(cred.user.uid, profile.displayName)
    set({ user: profile, isAuthenticated: true })
    return profile
  },

  logout: async () => {
    const { user } = get()
    if (user?.id) await goOffline(user.id)
    await signOut(auth)
    set({ user: null, isAuthenticated: false })
  },

  updateUser: (user) => set({ user }),
}))
