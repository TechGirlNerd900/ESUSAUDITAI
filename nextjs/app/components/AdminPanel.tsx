'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import LoadingSpinner from './LoadingSpinner'
import AuditLogViewer from './AuditLogViewer'

interface User {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  last_sign_in_at: string | null
  deleted_at?: string
  custom_fields?: any
  tags?: string[]
  organization_id: string
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [metaUser, setMetaUser] = useState<User | null>(null)
  const [metaEditMode, setMetaEditMode] = useState(false)
  const [metaCustomFields, setMetaCustomFields] = useState<any>({})
  const [metaTags, setMetaTags] = useState<string[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [auditUser, setAuditUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(users)
    } catch (error) {
      console.error('Error fetching users:', error)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    } catch (error) {
      console.error('Error updating user role:', error)
      setError('Failed to update user role')
    }
  }

  async function updateUserStatus(userId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ))
    } catch (error) {
      console.error('Error updating user status:', error)
      setError('Failed to update user status')
    }
  }

  async function handleArchiveRestore(user: User) {
    setLoadingId(user.id)
    setError(null)
    try {
      const endpoint = user.deleted_at
        ? `/api/users/${user.id}/restore`
        : `/api/users/${user.id}/archive`
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to update user')
      // Optimistically update UI
      setUsers(users =>
        users.map(u =>
          u.id === user.id
            ? { ...u, deleted_at: user.deleted_at ? null : new Date().toISOString() }
            : u
        )
      )
    } catch (e) {
      setError('Failed to update user. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  function openMetaModal(user: User) {
    setMetaUser(user)
    setMetaCustomFields(user.custom_fields || {})
    setMetaTags(user.tags || [])
    setMetaEditMode(false)
    setMetaError(null)
  }

  async function handleMetaSave() {
    if (!metaUser) return
    setMetaLoading(true)
    setMetaError(null)
    try {
      const res = await fetch(`/api/users/${metaUser.id}/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: metaCustomFields, tags: metaTags })
      })
      if (!res.ok) throw new Error('Failed to update meta')
      setMetaEditMode(false)
      // Optionally, refetch users or update local state
    } catch (e) {
      setMetaError('Failed to update. Please try again.')
    } finally {
      setMetaLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 text-center">
        {error}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Sign In
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Meta
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className={user.deleted_at ? 'opacity-60' : ''}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {user.email}
                {user.deleted_at && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Archived</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <select
                  value={user.role}
                  onChange={(e) => updateUserRole(user.id, e.target.value)}
                  className="block w-full pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  disabled={!!user.deleted_at}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <select
                  value={user.status}
                  onChange={(e) => updateUserStatus(user.id, e.target.value)}
                  className="block w-full pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  disabled={!!user.deleted_at}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shadow transition-colors
                    ${user.deleted_at
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'}
                    ${loadingId === user.id ? 'opacity-50 cursor-wait' : ''}`}
                  onClick={() => handleArchiveRestore(user)}
                  disabled={loadingId === user.id}
                  title={user.deleted_at ? 'Restore User' : 'Archive User'}
                >
                  {loadingId === user.id ? (
                    <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  ) : user.deleted_at ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
                      Restore
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      Archive
                    </>
                  )}
                </button>
                <button
                  className="btn btn-secondary text-xs px-2 py-1 ml-2"
                  onClick={() => setAuditUser(user)}
                  disabled={!!user.deleted_at}
                  title="View Audit Trail"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h6" /></svg>
                  Audit Trail
                </button>
                {error && loadingId === user.id && <div className="text-xs text-red-500 mt-1">{error}</div>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  className="btn btn-secondary text-xs px-2 py-1"
                  onClick={() => openMetaModal(user)}
                  disabled={!!user.deleted_at}
                >Meta</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {metaUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setMetaUser(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-lg font-semibold mb-2">User Meta</h3>
            {!metaEditMode ? (
              <>
                <div className="mb-3">
                  <h4 className="font-semibold mb-1 text-xs">Custom Fields</h4>
                  <pre className="bg-gray-50 p-2 rounded text-xs text-gray-700">{JSON.stringify(metaCustomFields, null, 2)}</pre>
                </div>
                <div className="mb-3">
                  <h4 className="font-semibold mb-1 text-xs">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {metaTags.length ? metaTags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{tag}</span>
                    )) : <span className="text-gray-400 text-xs">No tags</span>}
                  </div>
                </div>
                <button
                  className="btn btn-primary text-xs px-3 py-1"
                  onClick={() => setMetaEditMode(true)}
                >Edit</button>
              </>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleMetaSave() }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Custom Fields (JSON)</label>
                  <textarea
                    className="w-full p-2 border rounded text-xs"
                    rows={4}
                    value={JSON.stringify(metaCustomFields, null, 2)}
                    onChange={e => {
                      try {
                        setMetaCustomFields(JSON.parse(e.target.value))
                        setMetaError(null)
                      } catch {
                        setMetaError('Invalid JSON')
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tags (comma separated)</label>
                  <input
                    className="w-full p-2 border rounded text-xs"
                    value={metaTags.join(', ')}
                    onChange={e => setMetaTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  />
                </div>
                {metaError && <div className="text-red-500 text-xs">{metaError}</div>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary text-xs px-3 py-1"
                    disabled={metaLoading || !!metaError}
                  >{metaLoading ? 'Saving...' : 'Save'}</button>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-3 py-1"
                    onClick={() => { setMetaEditMode(false); setMetaError(null); }}
                  >Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {auditUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setAuditUser(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <AuditLogViewer
              organizationId={auditUser.organization_id}
              resourceType="users"
              resourceId={auditUser.id}
            />
          </div>
        </div>
      )}
    </div>
  )
}