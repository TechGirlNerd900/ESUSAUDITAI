import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { 
    UserGroupIcon,
    UserIcon,
    PencilIcon,
    KeyIcon,
    TrashIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ShieldCheckIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserPlusIcon,
    ClockIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import { 
    CheckCircleIcon as CheckCircleIconSolid,
    XCircleIcon as XCircleIconSolid,
    ShieldCheckIcon as ShieldCheckIconSolid 
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('edit'); // 'edit', 'details', 'activity'
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });
    const [userStats, setUserStats] = useState({
        usersByRole: {},
        usersByStatus: {},
        recentRegistrations: 0,
        totalUsers: 0
    });
    const [formData, setFormData] = useState({
        role: '',
        isActive: true,
        company: '',
        firstName: '',
        lastName: '',
        email: ''
    });
    const [userActivity, setUserActivity] = useState([]);
    const [activityStats, setActivityStats] = useState({});

    // API helper function
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`/api${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user?.token || ''}`,
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    };

    // Fetch users with filters and pagination
    const fetchUsers = async (page = 1, search = '', role = '', status = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString()
            });
            
            if (search) params.append('search', search);
            if (role && role !== 'all') params.append('role', role);
            if (status && status !== 'all') params.append('status', status);

            const data = await apiCall(`/admin/users?${params}`);
            
            if (data && data.users) {
                setUsers(data.users);
                setPagination(data.pagination || pagination);
            }
            
        } catch (error) {
            toast.error('Failed to fetch users');
            console.error('Error fetching users:', error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch user statistics
    const fetchUserStats = async () => {
        try {
            const data = await apiCall('/admin/users/stats/overview');
            if (data) {
                setUserStats(data);
            }
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    // Fetch user details
    const fetchUserDetails = async (userId) => {
        try {
            const data = await apiCall(`/admin/users/${userId}`);
            if (data && data.user) {
                setSelectedUser(data.user);
                return data;
            }
        } catch (error) {
            toast.error('Failed to fetch user details');
            console.error('Error fetching user details:', error);
        }
    };

    // Fetch user activity
    const fetchUserActivity = async (userId, days = 30) => {
        try {
            const data = await apiCall(`/admin/users/${userId}/activity?days=${days}`);
            if (data) {
                setUserActivity(data.activities || []);
                setActivityStats(data.stats || {});
                return data;
            }
        } catch (error) {
            toast.error('Failed to fetch user activity');
            console.error('Error fetching user activity:', error);
            setUserActivity([]);
            setActivityStats({});
        }
    };

    // Create new user
    const createUser = async (userData) => {
        try {
            await apiCall('/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    email: userData.email,
                    role: userData.role,
                    is_active: userData.isActive,
                    company: userData.company
                })
            });
            
            toast.success('User created successfully');
            await fetchUsers(pagination.page, searchTerm, roleFilter, statusFilter);
            await fetchUserStats();
            setShowModal(false);
            setSelectedUser(null);
            
        } catch (error) {
            toast.error(error.message || 'Failed to create user');
            console.error('Error creating user:', error);
        }
    };
    const updateUser = async (userId, updateData) => {
        try {
            await apiCall(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            toast.success('User updated successfully');
            await fetchUsers(pagination.page, searchTerm, roleFilter, statusFilter);
            await fetchUserStats();
            setShowModal(false);
            setSelectedUser(null);
            
        } catch (error) {
            toast.error(error.message || 'Failed to update user');
            console.error('Error updating user:', error);
        }
    };

    // Delete user
    const deleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await apiCall(`/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            toast.success('User deleted successfully');
            await fetchUsers(pagination.page, searchTerm, roleFilter, statusFilter);
            await fetchUserStats();
            
        } catch (error) {
            toast.error(error.message || 'Failed to delete user');
            console.error('Error deleting user:', error);
        }
    };
    const resetUserPassword = async (userId) => {
        if (!window.confirm('Are you sure you want to reset this user\'s password?')) {
            return;
        }

        try {
            const data = await apiCall(`/admin/users/${userId}/reset-password`, {
                method: 'POST'
            });
            
            if (data && data.user) {
                toast.success(`Password reset email sent to ${data.user.email}`);
            } else {
                toast.success('Password reset email sent');
            }
            
        } catch (error) {
            toast.error(error.message || 'Failed to reset password');
            console.error('Error resetting password:', error);
        }
    };

    // Handle search
    const handleSearch = () => {
        fetchUsers(1, searchTerm, roleFilter, statusFilter);
    };

    // Handle filter change
    const handleFilterChange = (type, value) => {
        if (type === 'role') {
            setRoleFilter(value);
            fetchUsers(1, searchTerm, value, statusFilter);
        } else if (type === 'status') {
            setStatusFilter(value);
            fetchUsers(1, searchTerm, roleFilter, value);
        }
    };

    // Handle pagination
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchUsers(newPage, searchTerm, roleFilter, statusFilter);
        }
    };

    // Open modal
    const openModal = async (type, user = null) => {
        setModalType(type);
        setSelectedUser(user);
        
        if (user) {
            if (type === 'edit') {
                setFormData({
                    role: user.role || '',
                    isActive: user.is_active !== undefined ? user.is_active : true,
                    company: user.company || ''
                });
            } else if (type === 'details') {
                await fetchUserDetails(user.id);
            } else if (type === 'activity') {
                await fetchUserActivity(user.id);
            }
        } else if (type === 'create') {
            setFormData({
                role: '',
                isActive: true,
                company: '',
                firstName: '',
                lastName: '',
                email: ''
            });
        }
        
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedUser(null);
        setFormData({
            role: '',
            isActive: true,
            company: '',
            firstName: '',
            lastName: '',
            email: ''
        });
        setUserActivity([]);
        setActivityStats({});
    };

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (modalType === 'create') {
            await createUser(formData);
        } else if (modalType === 'edit' && selectedUser) {
            await updateUser(selectedUser.id, {
                role: formData.role,
                is_active: formData.isActive,
                company: formData.company
            });
        }
    };

    // Initial load
    useEffect(() => {
        fetchUsers();
        fetchUserStats();
    }, []);

    // Role color mapping
    const getRoleColor = (role) => {
        switch (role?.toLowerCase()) {
            case 'admin': return 'text-red-600 bg-red-100';
            case 'auditor': return 'text-blue-600 bg-blue-100';
            case 'reviewer': return 'text-green-600 bg-green-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    // Status color mapping
    const getStatusColor = (isActive) => {
        return isActive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
    };

    // Format date safely
    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return 'Invalid Date';
        }
    };

    // Format datetime safely
    const formatDateTime = (dateString) => {
        if (!dateString) return 'Never';
        try {
            return new Date(dateString).toLocaleString();
        } catch (error) {
            return 'Invalid Date';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
                <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">{userStats.totalUsers || 0}</p>
                        </div>
                        <UserGroupIcon className="h-8 w-8 text-blue-600" />
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Active Users</p>
                            <p className="text-2xl font-bold text-green-600">{userStats.usersByStatus?.active || 0}</p>
                        </div>
                        <CheckCircleIconSolid className="h-8 w-8 text-green-600" />
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Admins</p>
                            <p className="text-2xl font-bold text-red-600">{userStats.usersByRole?.admin || 0}</p>
                        </div>
                        <ShieldCheckIconSolid className="h-8 w-8 text-red-600" />
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Recent (30d)</p>
                            <p className="text-2xl font-bold text-purple-600">{userStats.recentRegistrations || 0}</p>
                        </div>
                        <ChartBarIcon className="h-8 w-8 text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow mb-6">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                            </div>
                            
                            {/* Role Filter */}
                            <div className="relative">
                                <select
                                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                                    value={roleFilter}
                                    onChange={(e) => handleFilterChange('role', e.target.value)}
                                >
                                    <option value="all">All Roles</option>
                                    <option value="admin">Admin</option>
                                    <option value="auditor">Auditor</option>
                                    <option value="reviewer">Reviewer</option>
                                </select>
                                <FunnelIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                            </div>
                            
                            {/* Status Filter */}
                            <div className="relative">
                                <select
                                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                                    value={statusFilter}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                                <ShieldCheckIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleSearch}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                                Search
                            </button>
                            <button
                                onClick={() => openModal('create')}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2"
                            >
                                <UserPlusIcon className="h-5 w-5" />
                                Add User
                            </button>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
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
                                    Company
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
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <UserIcon className="h-5 w-5 text-gray-500" />
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {user.first_name} {user.last_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                                                {user.role || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {user.company || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.is_active)}`}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(user.last_login_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openModal('details', user)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="View Details"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal('edit', user)}
                                                    className="text-green-600 hover:text-green-900"
                                                    title="Edit User"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => resetUserPassword(user.id)}
                                                    className="text-purple-600 hover:text-purple-900"
                                                    title="Reset Password"
                                                >
                                                    <KeyIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal('activity', user)}
                                                    className="text-orange-600 hover:text-orange-900"
                                                    title="View Activity"
                                                >
                                                    <ClockIcon className="h-4 w-4" />
                                                </button>
                                                {user.role !== 'admin' && (
                                                    <button
                                                        onClick={() => deleteUser(user.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Delete User"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!pagination.hasPrev}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!pagination.hasNext}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                                <span className="font-medium">
                                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                                </span> of{' '}
                                <span className="font-medium">{pagination.total}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={!pagination.hasPrev}
                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={!pagination.hasNext}
                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRightIcon className="h-5 w-5" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between pb-4 border-b">
                                <h3 className="text-lg font-medium text-gray-900">
                                    {modalType === 'create' && 'Add New User'}
                                    {modalType === 'edit' && 'Edit User'}
                                    {modalType === 'details' && 'User Details'}
                                    {modalType === 'activity' && 'User Activity'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XCircleIcon className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="mt-4">
                                {(modalType === 'edit' || modalType === 'create') && (
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {modalType === 'create' && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">First Name *</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                            value={formData.firstName}
                                                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                                            required
                                                            placeholder="Enter first name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                            value={formData.lastName}
                                                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                                            required
                                                            placeholder="Enter last name"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                                                    <input
                                                        type="email"
                                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                        required
                                                        placeholder="Enter email address"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Role *</label>
                                            <select
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                value={formData.role}
                                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                                                required
                                            >
                                                <option value="">Select a role</option>
                                                <option value="auditor">Auditor</option>
                                                <option value="reviewer">Reviewer</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Company</label>
                                            <input
                                                type="text"
                                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                value={formData.company}
                                                onChange={(e) => setFormData({...formData, company: e.target.value})}
                                                placeholder="Enter company name"
                                            />
                                        </div>
                                        
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                                            />
                                            <label className="ml-2 block text-sm text-gray-900">Active Account</label>
                                        </div>
                                        
                                        {modalType === 'create' && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                                <div className="flex">
                                                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                                                    <div className="ml-3">
                                                        <p className="text-sm text-yellow-700">
                                                            A temporary password will be generated and sent to the user's email address.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-end space-x-3 pt-4">
                                            <button
                                                type="button"
                                                onClick={closeModal}
                                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                                            >
                                                {modalType === 'create' ? 'Create User' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {modalType === 'details' && selectedUser && (
                                    <div className="space-y-4">
                                        {/* User Info */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {selectedUser.first_name} {selectedUser.last_name}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                                <p className="mt-1 text-sm text-gray-900">{selectedUser.email}</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                                <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(selectedUser.role)}`}>
                                                    {selectedUser.role || 'N/A'}
                                                </span>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                                <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedUser.is_active)}`}>
                                                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Company</label>
                                                <p className="mt-1 text-sm text-gray-900">{selectedUser.company || '-'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Last Login</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {formatDateTime(selectedUser.last_login_at)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Created</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {formatDateTime(selectedUser.created_at)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Updated</label>
                                                <p className="mt-1 text-sm text-gray-900">
                                                    {formatDateTime(selectedUser.updated_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {modalType === 'activity' && (
                                    <div className="space-y-4">
                                        {/* Activity Stats */}
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="text-center">
                                                <p className="text-lg font-semibold text-gray-900">{activityStats.totalActivities || 0}</p>
                                                <p className="text-sm text-gray-500">Total Activities</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-lg font-semibold text-green-600">{activityStats.successfulActions || 0}</p>
                                                <p className="text-sm text-gray-500">Successful</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-lg font-semibold text-red-600">{activityStats.failedActions || 0}</p>
                                                <p className="text-sm text-gray-500">Failed</p>
                                            </div>
                                        </div>

                                        {/* Activity List */}
                                        <div className="max-h-96 overflow-y-auto">
                                            {userActivity.length === 0 ? (
                                                <p className="text-gray-500 text-center py-4">No recent activity</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {userActivity.map((activity, index) => (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                                                <p className="text-xs text-gray-500">{activity.resource_type}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-gray-500">
                                                                    {formatDateTime(activity.created_at)}
                                                                </p>
                                                                {activity.success ? (
                                                                    <CheckCircleIcon className="h-4 w-4 text-green-500 inline" />
                                                                ) : (
                                                                    <XCircleIcon className="h-4 w-4 text-red-500 inline" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;