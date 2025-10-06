'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Switch } from '../components/ui/switch'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { User, Shield, Bell, Building, AlertTriangle, RefreshCw } from 'lucide-react' // Added AlertTriangle, RefreshCw
import { useRouter } from 'next/navigation' // Added useRouter

import { 
  handleApiError, 
  handleApiSuccess, 
  showToast, // Renamed from showErrorToast
  shouldRetryError, 
  ErrorCategory,
  ApiErrorResult 
} from '@/lib/utils/errorHandler' // Added error handling utility

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
  const [error, setError] = useState<ApiErrorResult | null>(null) // Changed error type
  const [successMessage, setSuccessMessage] = useState<string | null>(null) // Changed success state name and type
  const [retryCount, setRetryCount] = useState(0) // Added retry count state
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[] | null>(null) // Added field errors state
  
  const authenticatedFetch = useAuthenticatedFetch()
  const router = useRouter() // Initialize useRouter

  const fetchUserProfile = async () => {
    setLoading(true)
    setError(null) // Clear previous errors
    try {
      const response = await authenticatedFetch('/api/auth/profile')
      if (!response.ok) {
        const errorResult = await handleApiError(response, { 
          endpoint: 'user profile', 
          showToast: false, // Don't show toast for initial load errors, display inline
          resourceType: 'user profile'
        })
        setError(errorResult)
        if (errorResult.category === ErrorCategory.AUTHENTICATION_ERROR) {
          // Redirect to login page for authentication errors
          router.push('/login') 
        }
      } else {
        const successResult = await handleApiSuccess<any>(response)
        setUserProfile(successResult.data?.user)
        setError(null) // Clear error on success
      }
    } catch (e) {
      // Network errors or other unexpected fetch issues
      const errorResult = await handleApiError(null, { 
        endpoint: 'user profile', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      })
      setError(errorResult)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserProfile()
  }, [retryCount]) // Added retryCount to dependencies

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  const handleProfileUpdate = async (updatedData: Partial<UserProfile>) => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    setFieldErrors(null) // Clear field errors
    
    try {
      const response = await authenticatedFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })
      
      if (!response.ok) {
        const errorResult = await handleApiError(response, { 
          endpoint: 'profile update', 
          showToast: true 
        })
        setError(errorResult)
        setFieldErrors(errorResult.fieldErrors || null)
      } else {
        const successResult = await handleApiSuccess<any>(response)
        setUserProfile(successResult.data?.user)
        setSuccessMessage('Profile updated successfully')
        showToast('Profile updated successfully!', 'default') // Show success toast
        setError(null) // Clear error on success
        setFieldErrors(null) // Clear field errors on success
        setTimeout(() => setSuccessMessage(null), 5000) // Clear success message after 5 seconds
      }
    } catch (e) {
      // Network errors or other unexpected fetch issues
      const errorResult = await handleApiError(null, { 
        endpoint: 'profile update', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      })
      setError(errorResult)
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
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            {error.message}
            {error.shouldRetry && shouldRetryError(error.category, retryCount) && (
              <Button variant="ghost" onClick={handleRetry} className="ml-4">
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
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
                    className={fieldErrors?.some(err => err.field === 'firstName') ? 'border-red-500' : ''}
                  />
                  {fieldErrors?.find(err => err.field === 'firstName') && (
                    <p className="text-sm text-red-500">{fieldErrors.find(err => err.field === 'firstName')?.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={userProfile?.lastName || ''}
                    onChange={(e) => setUserProfile(prev => prev ? { ...prev, lastName: e.target.value } : null)}
                    className={fieldErrors?.some(err => err.field === 'lastName') ? 'border-red-500' : ''}
                  />
                  {fieldErrors?.find(err => err.field === 'lastName') && (
                    <p className="text-sm text-red-500">{fieldErrors.find(err => err.field === 'lastName')?.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile?.email || ''}
                  onChange={(e) => setUserProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className={fieldErrors?.some(err => err.field === 'email') ? 'border-red-500' : ''}
                />
                {fieldErrors?.find(err => err.field === 'email') && (
                    <p className="text-sm text-red-500">{fieldErrors.find(err => err.field === 'email')?.message}</p>
                  )}
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
                    View your recent login activity (Coming Soon)
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
                    Manage team members and their roles (Coming Soon)
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
