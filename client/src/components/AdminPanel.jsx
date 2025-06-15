import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import UserManagement from './UserManagement.jsx';
import { 
    CogIcon, 
    PlusIcon, 
    PencilIcon, 
    TrashIcon,
    EyeIcon,
    EyeSlashIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CloudIcon,
    ShieldCheckIcon,
    BoltIcon,
    ChartBarIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    SparklesIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import { 
    CheckCircleIcon as CheckCircleIconSolid,
    XCircleIcon as XCircleIconSolid,
    ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const AdminPanel = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [envVars, setEnvVars] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('env');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showConfirmDelete, setShowConfirmDelete] = useState(null);
    const [testingIntegration, setTestingIntegration] = useState(null);
    const [showPassword, setShowPassword] = useState({});
    const [stats, setStats] = useState({
        totalEnvVars: 0,
        sensitiveVars: 0,
        totalIntegrations: 0,
        activeIntegrations: 0,
        lastUpdated: null
    });

    // Check if user is admin
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    useEffect(() => {
        if (isAdmin) {
            loadData();
        }
    }, [isAdmin]);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadEnvironmentVars(),
                loadIntegrations()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const makeAdminRequest = async (endpoint, options = {}) => {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/admin${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    };

    const loadEnvironmentVars = async () => {
        try {
            const data = await makeAdminRequest('/env');
            setEnvVars(data.envVars || []);
            updateStats(data.envVars || [], integrations);
        } catch (error) {
            toast.error(`Failed to load environment variables: ${error.message}`);
        }
    };

    const loadIntegrations = async () => {
        try {
            const data = await makeAdminRequest('/integrations');
            setIntegrations(data.integrations || []);
            updateStats(envVars, data.integrations || []);
        } catch (error) {
            toast.error(`Failed to load API integrations: ${error.message}`);
        }
    };

    const updateStats = (envData, integrationsData) => {
        setStats({
            totalEnvVars: envData.length,
            sensitiveVars: envData.filter(env => env.sensitive).length,
            totalIntegrations: integrationsData.length,
            activeIntegrations: integrationsData.filter(int => int.enabled).length,
            lastUpdated: new Date()
        });
    };

    const openModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);
        
        if (type === 'env') {
            setFormData(item ? {
                key: item.key,
                value: '',
                description: item.description || '',
                category: item.category || 'custom',
                sensitive: item.sensitive || false
            } : {
                key: '',
                value: '',
                description: '',
                category: 'custom',
                sensitive: false
            });
        } else {
            setFormData(item ? {
                id: item.id,
                name: item.name,
                type: item.type,
                endpoint: item.endpoint,
                apiKey: '',
                config: JSON.stringify(item.config || {}, null, 2),
                enabled: item.enabled
            } : {
                id: '',
                name: '',
                type: 'custom',
                endpoint: '',
                apiKey: '',
                config: '{}',
                enabled: true
            });
        }
        
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            if (modalType === 'env') {
                await makeAdminRequest(`/env/${formData.key}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast.success('Environment variable saved successfully');
                loadEnvironmentVars();
            } else {
                const integrationId = formData.id || `integration_${Date.now()}`;
                await makeAdminRequest(`/integrations/${integrationId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast.success('API integration saved successfully');
                loadIntegrations();
            }
            closeModal();
        } catch (error) {
            toast.error(`Failed to save: ${error.message}`);
        }
    };

    const handleDelete = async (type, id) => {
        if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

        try {
            if (type === 'env') {
                await makeAdminRequest(`/env/${id}`, { method: 'DELETE' });
                toast.success('Environment variable deleted');
                loadEnvironmentVars();
            } else {
                await makeAdminRequest(`/integrations/${id}`, { method: 'DELETE' });
                toast.success('API integration deleted');
                loadIntegrations();
            }
        } catch (error) {
            toast.error(`Failed to delete: ${error.message}`);
        }
    };

    const testIntegration = async (id) => {
        try {
            setLoading(true);
            const result = await makeAdminRequest(`/integrations/${id}/test`, {
                method: 'POST'
            });
            
            if (result.test.success) {
                toast.success(`Integration test successful: ${result.test.message}`);
            } else {
                toast.error(`Integration test failed: ${result.test.message}`);
            }
        } catch (error) {
            toast.error(`Test failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const reloadEnvironment = async () => {
        try {
            await makeAdminRequest('/reload-env', { method: 'POST' });
            toast.success('Environment reload requested. Server restart required.');
        } catch (error) {
            toast.error(`Failed to reload environment: ${error.message}`);
        }
    };

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        You don't have permission to access the admin panel.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div className="md:flex md:items-center md:justify-between animate-fade-in-up">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-soft mr-4">
                                <CogIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Admin Panel
                                </h2>
                                <p className="mt-1 text-lg text-gray-600">
                                    Manage environment variables and API integrations
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex md:mt-0 md:ml-4">
                        <button
                            onClick={reloadEnvironment}
                            className="btn-secondary hover-lift group"
                        >
                            <ArrowPathIcon className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-300" />
                            Reload Environment
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mt-8">
                    <nav className="flex space-x-1 bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('env')}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeTab === 'env'
                                    ? 'bg-white text-blue-600 shadow-soft'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                        >
                            <div className="flex items-center justify-center">
                                <CogIcon className="h-4 w-4 mr-2" />
                                Environment Variables 
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === 'env' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {envVars.length}
                                </span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('integrations')}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeTab === 'integrations'
                                    ? 'bg-white text-blue-600 shadow-soft'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                        >
                            <div className="flex items-center justify-center">
                                <CloudIcon className="h-4 w-4 mr-2" />
                                API Integrations 
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === 'integrations' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {integrations.length}
                                </span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                activeTab === 'users'
                                    ? 'bg-white text-blue-600 shadow-soft'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                            }`}
                        >
                            <div className="flex items-center justify-center">
                                <UserGroupIcon className="h-4 w-4 mr-2" />
                                User Management
                            </div>
                        </button>
                    </nav>
                </div>

                {/* Environment Variables Tab */}
                {activeTab === 'env' && (
                    <div className="mt-8 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <ShieldCheckIcon className="h-5 w-5 mr-2 text-green-600" />
                                    Environment Variables
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">Manage your application's environment configuration</p>
                            </div>
                            <button
                                onClick={() => openModal('env')}
                                className="btn-primary hover-lift group"
                            >
                                <PlusIcon className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                                Add Variable
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {envVars.map((envVar, index) => (
                                <div 
                                    key={envVar.key} 
                                    className="card-gradient hover-lift p-6 stagger-item animate-fade-in-up"
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center mb-2">
                                                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg mr-3">
                                                    <span className="text-xs font-bold text-white">{envVar.key.charAt(0)}</span>
                                                </div>
                                                <h4 className="text-lg font-semibold text-gray-900">
                                                    {envVar.key}
                                                </h4>
                                                {envVar.sensitive && (
                                                    <span className="ml-3 badge badge-danger">
                                                        <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                                        Sensitive
                                                    </span>
                                                )}
                                                <span className="ml-2 badge badge-gray">
                                                    {envVar.category}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {envVar.description || 'No description provided'}
                                            </p>
                                            <div className="flex items-center text-xs text-gray-500">
                                                <InformationCircleIcon className="h-4 w-4 mr-1" />
                                                Value length: {envVar.actualLength} characters
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => openModal('env', envVar)}
                                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                                title="Edit variable"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete('env', envVar.key)}
                                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                                                title="Delete variable"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* API Integrations Tab */}
                {activeTab === 'integrations' && (
                    <div className="mt-8 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <CloudIcon className="h-5 w-5 mr-2 text-blue-600" />
                                    API Integrations
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">Configure and manage external API connections</p>
                            </div>
                            <button
                                onClick={() => openModal('integration')}
                                className="btn-primary hover-lift group"
                            >
                                <PlusIcon className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
                                Add Integration
                            </button>
                        </div>

                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                {integrations.map((integration) => (
                                    <li key={integration.id} className="px-6 py-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {integration.name}
                                                    </p>
                                                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        integration.enabled 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {integration.enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {integration.type}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    {integration.endpoint}
                                                </p>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    API Key length: {integration.keyLength} characters
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => testIntegration(integration.id)}
                                                    className="text-green-600 hover:text-green-900"
                                                    disabled={loading}
                                                >
                                                    <CheckCircleIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal('integration', integration)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete('integration', integration.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* User Management Tab */}
                {activeTab === 'users' && (
                    <div className="mt-8 animate-fade-in-up">
                        <UserManagement />
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                            </div>

                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <form onSubmit={handleSubmit}>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                            {editingItem ? 'Edit' : 'Add'} {modalType === 'env' ? 'Environment Variable' : 'API Integration'}
                                        </h3>

                                        {modalType === 'env' ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Key</label>
                                                    <input
                                                        type="text"
                                                        value={formData.key || ''}
                                                        onChange={(e) => setFormData({...formData, key: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                        disabled={editingItem}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Value</label>
                                                    <input
                                                        type={formData.sensitive ? 'password' : 'text'}
                                                        value={formData.value || ''}
                                                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                                    <textarea
                                                        value={formData.description || ''}
                                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        rows="2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                                    <select
                                                        value={formData.category || 'custom'}
                                                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                    >
                                                        <option value="database">Database</option>
                                                        <option value="azure">Azure</option>
                                                        <option value="auth">Authentication</option>
                                                        <option value="security">Security</option>
                                                        <option value="monitoring">Monitoring</option>
                                                        <option value="custom">Custom</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.sensitive || false}
                                                        onChange={(e) => setFormData({...formData, sensitive: e.target.checked})}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                    />
                                                    <label className="ml-2 block text-sm text-gray-900">
                                                        Sensitive (mask value)
                                                    </label>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                                    <input
                                                        type="text"
                                                        value={formData.name || ''}
                                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                                    <select
                                                        value={formData.type || 'custom'}
                                                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                    >
                                                        <option value="azure_openai">Azure OpenAI</option>
                                                        <option value="azure_form_recognizer">Azure Form Recognizer</option>
                                                        <option value="azure_search">Azure Search</option>
                                                        <option value="custom">Custom</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Endpoint URL</label>
                                                    <input
                                                        type="url"
                                                        value={formData.endpoint || ''}
                                                        onChange={(e) => setFormData({...formData, endpoint: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={formData.apiKey || ''}
                                                        onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Configuration (JSON)</label>
                                                    <textarea
                                                        value={formData.config || '{}'}
                                                        onChange={(e) => setFormData({...formData, config: e.target.value})}
                                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        rows="4"
                                                    />
                                                </div>
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.enabled || false}
                                                        onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                    />
                                                    <label className="ml-2 block text-sm text-gray-900">
                                                        Enabled
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                        <button
                                            type="submit"
                                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;