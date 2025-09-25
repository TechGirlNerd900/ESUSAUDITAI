'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Switch } from '../components/ui/switch'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { Skeleton } from '../components/ui/skeleton'
import { Alert, AlertDescription } from '../components/ui/alert'
import { User, Shield, Bell, Building } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId: string
}

export default function SettingsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const authenticatedFetch = useAuthenticatedFetch()

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/auth/profile')
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.user)
      } else {
        setError('Failed to load user profile')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const handleProfileUpdate = async (updatedData: Partial<UserProfile>) => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      
      const response = await authenticatedFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.user)
        setSuccess('Profile updated successfully')
      } else {
        setError('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setError('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="organization">
            <Building className="mr-2 h-4 w-4" />
            Organization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={userProfile?.firstName || ''}
                    onChange={(e) => setUserProfile(prev => prev ? { ...prev, firstName: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={userProfile?.lastName || ''}
                    onChange={(e) => setUserProfile(prev => prev ? { ...prev, lastName: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile?.email || ''}
                  onChange={(e) => setUserProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={userProfile?.role || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-gray-500">
                  Contact your administrator to change your role
                </p>
              </div>
              <Button 
                onClick={() => userProfile && handleProfileUpdate(userProfile)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Change Password</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Password change functionality coming soon. Please contact support for password changes.
                  </p>
                  <Button variant="outline" disabled>
                    Change Password
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <div className="flex items-center space-x-2">
                    <Switch id="2fa" disabled />
                    <Label htmlFor="2fa">Enable 2FA (Coming Soon)</Label>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Login History</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    View your recent login activity
                  </p>
                  <Button variant="outline" disabled>
                    View Login History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500">Receive email updates about your projects</p>
                  </div>
                  <Switch disabled />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Document Processing</Label>
                    <p className="text-sm text-gray-500">Get notified when document analysis is complete</p>
                  </div>
                  <Switch disabled />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Report Generation</Label>
                    <p className="text-sm text-gray-500">Alerts when reports are ready for review</p>
                  </div>
                  <Switch disabled />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Team Updates</Label>
                    <p className="text-sm text-gray-500">Notifications about team member activities</p>
                  </div>
                  <Switch disabled />
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mt-4">
                Notification preferences coming soon. All notifications are currently enabled by default.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Organization ID</Label>
                  <Input
                    value={userProfile?.organizationId || ''}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Team Management</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Manage team members and their roles
                  </p>
                  <Button variant="outline" disabled>
                    Manage Team (Admin Only)
                  </Button>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Billing & Subscription</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    View and manage your subscription
                  </p>
                  <Button variant="outline" disabled>
                    View Billing (Coming Soon)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
