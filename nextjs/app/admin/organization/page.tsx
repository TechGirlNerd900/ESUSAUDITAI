'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/app/components/LoadingSpinner'

interface Organization {
  id: string
  name: string
  logo_url?: string
  created_at: string
  updated_at: string
}

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'auditor' | 'reviewer'
  status: string
  is_active: boolean
  last_login_at?: string
  created_at: string
}

interface Invitation {
  token: string
  email: string
  role: string
  firstName: string
  lastName: string
  organizationName: string
  createdAt: string
  expiresAt: string
}

export default function OrganizationAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Invite form state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'auditor'
  })
  const [inviteLoading, setInviteLoading] = useState(false)

  // Organization edit state
  const [editingOrg, setEditingOrg] = useState(false)
  const [orgForm, setOrgForm] = useState({
    name: '',
    logo_url: ''
  })

  useEffect(() => {
    loadOrganizationData()
  }, [])

  const loadOrganizationData = async () => {
    try {
      setLoading(true)
      
      // Load organization details
      const orgResponse = await fetch('/api/organizations')
      if (!orgResponse.ok) {
        throw new Error('Failed to load organization')
      }
      const orgData = await orgResponse.json()
      setOrganization(orgData.organization)
      setOrgForm({
        name: orgData.organization.name,
        logo_url: orgData.organization.logo_url || ''
      })

      // Load organization users
      const usersResponse = await fetch('/api/admin/users')
      if (!usersResponse.ok) {
        throw new Error('Failed to load users')
      }
      const usersData = await usersResponse.json()
      setUsers(usersData.users || [])

      // Load pending invitations
      const invitesResponse = await fetch('/api/organizations/invite')
      if (!invitesResponse.ok) {
        throw new Error('Failed to load invitations')
      }
      const invitesData = await invitesResponse.json()
      setInvitations(invitesData.invitations || [])

    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/organizations/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setSuccess(data.message)
      setShowInviteModal(false)
      setInviteForm({
        email: '',
        firstName: '',
        lastName: '',
        role: 'auditor'
      })

      // Reload invitations
      await loadOrganizationData()

    } catch (error: any) {
      setError(error.message)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/organizations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orgForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization')
      }

      setOrganization(data.organization)
      setEditingOrg(false)
      setSuccess('Organization updated successfully')

    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleUserStatusToggle = async (userId: string, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update user status')
      }

      // Reload users
      await loadOrganizationData()
      setSuccess(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)

    } catch (error: any) {
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="text-gray-600 mt-1">Manage your organization settings and team members</p>
        </div>
        <button
          onClick={() => router.push('/admin')}
          className="btn-secondary"
        >
          ← Back to Admin
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Organization Details */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>
            <button
              onClick={() => setEditingOrg(!editingOrg)}
              className="btn-secondary"
            >
              {editingOrg ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {editingOrg ? (
            <form onSubmit={handleUpdateOrganization} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL (Optional)
                </label>
                <input
                  type="url"
                  value={orgForm.logo_url}
                  onChange={(e) => setOrgForm(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="input-field"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOrg(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <p className="text-lg text-gray-900 mt-1">{organization?.name}</p>
              </div>
              {organization?.logo_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Logo</label>
                  <img 
                    src={organization.logo_url} 
                    alt="Organization Logo" 
                    className="h-16 w-auto mt-1 rounded"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <strong>Created:</strong> {new Date(organization?.created_at || '').toLocaleDateString()}
                </div>
                <div>
                  <strong>Last Updated:</strong> {new Date(organization?.updated_at || '').toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Team Members ({users.length})</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary"
            >
              + Invite User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'auditor' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleUserStatusToggle(user.id, !user.is_active)}
                      className={`text-${user.is_active ? 'red' : 'green'}-600 hover:text-${user.is_active ? 'red' : 'green'}-900`}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pending Invitations ({invitations.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invited User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <tr key={invitation.token}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {invitation.firstName} {invitation.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{invitation.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {invitation.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitation.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
            </div>

            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                  className="input-field"
                  required
                >
                  <option value="auditor">Auditor</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}