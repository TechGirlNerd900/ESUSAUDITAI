import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
    SparklesIcon, 
    ShieldCheckIcon, 
    DocumentTextIcon,
    ChartBarIcon,
    EyeIcon,
    EyeSlashIcon
} from '@heroicons/react/24/outline';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { signIn } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(email, password);
        } catch (error) {
            setError(error.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 p-12 items-center justify-center relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 border border-white rounded-full"></div>
                    <div className="absolute bottom-10 right-10 w-24 h-24 border border-white rounded-full"></div>
                    <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-white rounded-full transform -translate-y-1/2"></div>
                </div>
                
                <div className="relative z-10 text-white text-center">
                    {/* Logo/Brand */}
                    <div className="mb-8">
                        <div className="flex items-center justify-center mb-4">
                            <SparklesIcon className="h-12 w-12 text-white mr-3" />
                            <h1 className="text-4xl font-bold">Esus</h1>
                            <span className="text-2xl font-light ml-2">AuditAI</span>
                        </div>
                        <p className="text-blue-100 text-lg">
                            Intelligent Audit Automation Platform
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-6 max-w-md mx-auto">
                        <div className="flex items-center text-left">
                            <DocumentTextIcon className="h-8 w-8 text-blue-200 mr-4 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold">AI-Powered Document Analysis</h3>
                                <p className="text-sm text-blue-100">Extract insights from financial documents automatically</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center text-left">
                            <ChartBarIcon className="h-8 w-8 text-blue-200 mr-4 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold">Intelligent Reporting</h3>
                                <p className="text-sm text-blue-100">Generate comprehensive audit reports with AI assistance</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center text-left">
                            <ShieldCheckIcon className="h-8 w-8 text-blue-200 mr-4 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold">Enterprise Security</h3>
                                <p className="text-sm text-blue-100">Bank-grade security with comprehensive audit trails</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 text-sm text-blue-200">
                        "Transforming audit workflows with the power of AI"
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="flex items-center justify-center mb-4">
                            <SparklesIcon className="h-10 w-10 text-blue-600 mr-3" />
                            <h1 className="text-3xl font-bold text-gray-900">Esus</h1>
                            <span className="text-xl font-light text-gray-600 ml-2">AuditAI</span>
                        </div>
                        <p className="text-gray-600">
                            Intelligent Audit Automation Platform
                        </p>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            Welcome back
                        </h2>
                        <p className="text-gray-600 mb-8">
                            Sign in to access your audit workspace
                        </p>
                    </div>

                    <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        ) : (
                                            <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <Link 
                                    to="/register" 
                                    className="font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
                                >
                                    Need an account? Sign up
                                </Link>
                                <Link 
                                    to="/reset-password" 
                                    className="font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <>
                                        <LoadingSpinner />
                                        <span className="ml-2">Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="h-5 w-5 mr-2" />
                                        Sign in to EsusAuditAI
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Additional Features */}
                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-4">
                                    Trusted by audit professionals worldwide
                                </p>
                                <div className="flex justify-center space-x-6 text-xs text-gray-500">
                                    <div className="flex items-center">
                                        <ShieldCheckIcon className="h-4 w-4 mr-1" />
                                        SOC 2 Compliant
                                    </div>
                                    <div className="flex items-center">
                                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                                        AI-Powered
                                    </div>
                                    <div className="flex items-center">
                                        <ChartBarIcon className="h-4 w-4 mr-1" />
                                        Enterprise Ready
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
