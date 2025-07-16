'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Briefcase,
  CheckCircle,
} from 'lucide-react';

const ProgressBar = ({ step }: { step: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-8">
    <motion.div
      className="bg-blue-600 h-1.5 rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${(step / 3) * 100}%` }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    />
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
      setStep(2);
    }
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (step === 2) {
      if (formData.password !== formData.confirmPassword) {
        return setError('Passwords do not match');
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        return setError(
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
        );
      }
    }

    if (step < 3) {
      return nextStep();
    }

    setLoading(true);
    setSuccess('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, registrationType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      setSuccess(data.message || 'Account created successfully. Redirecting...');
      setTimeout(
        () => router.push('/login?message=Please check your email to verify your account'),
        2000
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    const variants = {
      hidden: { opacity: 0, x: 50 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -50 },
    };

    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-center"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-6">How are you joining?</h3>
            <div className="space-y-4">
              <button
                onClick={() => {
                  setRegistrationType('create_org');
                  nextStep();
                }}
                className="w-full btn-outline flex items-center justify-center text-lg py-4 transition-all hover:bg-blue-50"
              >
                <Building className="mr-3 h-6 w-6 text-blue-600" /> Create a New Organization
              </button>
              <button
                onClick={() => {
                  setRegistrationType('join_invite');
                  nextStep();
                }}
                className="w-full btn-outline flex items-center justify-center text-lg py-4 transition-all hover:bg-blue-50"
              >
                <UserPlus className="mr-3 h-6 w-6 text-blue-600" /> Join with an Invite Code
              </button>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="step2"
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Tell us about yourself
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  name="firstName"
                  type="text"
                  placeholder="First Name"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="input pl-10"
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  name="lastName"
                  type="text"
                  placeholder="Last Name"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                name="email"
                type="email"
                placeholder="Email Address"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="input pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="input pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="input pl-10"
              />
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="step3"
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4"
          >
            {registrationType === 'create_org' ? (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Organization Details
                </h3>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    name="organizationName"
                    type="text"
                    placeholder="Organization Name"
                    required
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    className="input pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  You will become the administrator of this organization.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Invitation</h3>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    name="inviteToken"
                    type="text"
                    placeholder="Invitation Token"
                    required
                    value={formData.inviteToken}
                    onChange={handleInputChange}
                    className="input pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Check your email for the invitation token.
                </p>
              </div>
            )}
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Create Your Account</h2>
            <p className="text-gray-600 mt-2">Welcome to Esus Audit AI</p>
          </div>

          <ProgressBar step={step} />

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-center text-sm text-red-600 bg-red-50 p-3 rounded-lg"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-center text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center justify-center"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8">
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="btn-outline flex items-center"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </button>
                )}
              </div>
              <div>
                {step < 3 && (
                  <button type="submit" className="btn-primary flex items-center">
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex items-center"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
        <div className="bg-gray-50 p-4 text-center text-sm">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
