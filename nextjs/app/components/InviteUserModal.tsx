'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MailCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = [
  { value: 'auditor', label: 'Auditor' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'admin', label: 'Admin' },
];

export default function InviteUserModal({ isOpen, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const authenticatedFetch = useAuthenticatedFetch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !role) {
      setError('Please fill in all fields.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await authenticatedFetch('/api/organizations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation.');
      }

      setSent(true);
      setEmail('');
      setRole('');
      onSuccess();
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setSent(false);
    setEmail('');
    setRole('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg w-full max-w-md"
      >
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Invite User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <MailCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invitation Sent!</h3>
              <p className="text-gray-600 mb-6">
                An invitation has been sent to <span className="font-medium">{email}</span>.
              </p>
              <Button onClick={handleReset} className="w-full">
                Close
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={setRole} value={role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex space-x-2 pt-4">
                <Button
                  type="submit"
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? 'Sending...' : 'Send Invitation'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
