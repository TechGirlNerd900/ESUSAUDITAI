'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { EnvVarsTab } from '@/components/config/EnvVarsTab';
import { IntegrationsTab } from '@/components/config/IntegrationsTab';

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('env');

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Environment Configuration</h1>
        <p className="text-gray-600">
          Manage environment variables and API integrations for your organization
        </p>
      </div>

      <Tabs defaultValue="env" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="env">Environment Variables</TabsTrigger>
          <TabsTrigger value="integrations">API Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="env" className="space-y-4">
          <div className="mb-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Security Notice</AlertTitle>
              <AlertDescription>
                Environment variables marked as sensitive are encrypted in the database and masked in the UI. 
                Changes to environment variables may require application restart to take effect.
              </AlertDescription>
            </Alert>
          </div>
          <EnvVarsTab />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="mb-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Organization Scope</AlertTitle>
              <AlertDescription>
                API integrations are scoped to your organization. Only admins can manage integrations, 
                and they will be available to all users within your organization.
              </AlertDescription>
            </Alert>
          </div>
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}