import React, { useState } from 'react';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';
import { authService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const Settings = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    company: user?.company || ''
  });

  const updateProfileMutation = useMutation(authService.updateProfile, {
    onSuccess: () => {
      toast.success('Profile updated successfully!');
    },
    onError: (error) => {
      toast.error(error.error || 'Failed to update profile');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h1 className="text-lg font-medium text-gray-900">Account Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Update your personal information and preferences.
            </p>
          </div>
          
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    className="mt-1 input"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    className="mt-1 input"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  disabled
                  className="mt-1 input bg-gray-50 text-gray-500"
                  value={user?.email || ''}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email address cannot be changed.
                </p>
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                  Company
                </label>
                <input
                  type="text"
                  name="company"
                  id="company"
                  className="mt-1 input"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <input
                  type="text"
                  name="role"
                  id="role"
                  disabled
                  className="mt-1 input bg-gray-50 text-gray-500 capitalize"
                  value={user?.role || ''}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Role is assigned by your administrator.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isLoading}
                  className="btn-primary"
                >
                  {updateProfileMutation.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Account Information */}
        <div className="mt-8 card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">Account Information</h2>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Member since</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Account status</dt>
                <dd className="mt-1">
                  <span className="badge badge-success">Active</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
