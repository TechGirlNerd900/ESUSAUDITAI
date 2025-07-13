'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';

// SVG Icon for the header
const HeaderIcon = () => (
  <svg
    className="h-8 w-8 text-white"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  </svg>
);

// Progress Bar Component
const ProgressBar = ({ step }: { step: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
    <div
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
      style={{ width: `${(step / 3) * 100}%` }}
    ></div>
  </div>
);

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [registrationType, setRegistrationType] = useState<'create_org' | 'join_invite'>(
    'create_org'
  );
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organizationName: '',
    inviteToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      setFormData((prev) => ({ ...prev, inviteToken: invite }));
      setRegistrationType('join_invite');
      setStep(2); // Skip to personal info if invite token is present
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 3) {
      if (step === 2) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        const passwordRegex =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(formData.password)) {
          setError(
            'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
          );
          return;
        }
      }
      nextStep();
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          organizationName: formData.organizationName,
          inviteToken: formData.inviteToken,
          registrationType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(data.message);

      setTimeout(() => {
        router.push('/login?message=Please check your email to verify your account');
      }, 2000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-900 bg-cover bg-center flex items-center justify-center p-4"
      style={{ backgroundImage: 'url(/grid.svg)' }}
    >
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 transition-all duration-500">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
              <HeaderIcon />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create Your Account</h2>
            <p className="text-gray-600 mt-2">Join EsusAuditAI and streamline your audit process</p>
          </div>

          <ProgressBar step={step} />

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="animate-fade-in-up">
                <h3 className="text-lg font-medium text-gray-900 mb-4">How are you joining?</h3>
                <div className="flex rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationType('create_org');
                      nextStep();
                    }}
                    className="flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-300 ease-in-out transform hover:scale-105 bg-white text-blue-600 shadow-sm"
                  >
                    Create Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationType('join_invite');
                      nextStep();
                    }}
                    className="flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-300 ease-in-out transform hover:scale-105 bg-white text-blue-600 shadow-sm ml-2"
                  >
                    Join by Invitation
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in-up">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tell us about yourself</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      First Name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="john@company.com"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in-up">
                {registrationType === 'create_org' ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h3>
                    <label
                      htmlFor="organizationName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Organization Name
                    </label>
                    <input
                      id="organizationName"
                      name="organizationName"
                      type="text"
                      required
                      value={formData.organizationName}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Your Company Name"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You will become the administrator of this organization
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Invitation</h3>
                    <label
                      htmlFor="inviteToken"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Invitation Token
                    </label>
                    <input
                      id="inviteToken"
                      name="inviteToken"
                      type="text"
                      required
                      value={formData.inviteToken}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter invitation token from email"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Check your email for the invitation token
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-shake">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">{success}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                style={{ maxWidth: '200px' }}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating Account...
                  </div>
                ) : step < 3 ? (
                  'Next'
                ) : (
                  `Create Account${registrationType === 'create_org' ? ' & Organization' : ''}`
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
