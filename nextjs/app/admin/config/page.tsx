'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';
import { ConfigCategory, IntegrationType } from '@/lib/configManager';

// Environment variable interface
interface EnvVar {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  sensitive: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

// API integration interface
interface ApiIntegration {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  api_key: string;
  config: Record<string, any>;
  enabled: boolean;
  last_test_result?: Record<string, any>;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Test result interface
interface TestResult {
  success: boolean;
  responseTime?: number;
  error?: string;
  [key: string]: any;
}

export default function ConfigPage() {
  // const router = useRouter(); // Uncomment if navigation is needed in the future
  const [activeTab, setActiveTab] = useState('env');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [showIntegrationDialog, setShowIntegrationDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // New environment variable form state
  const [newEnv, setNewEnv] = useState<Partial<EnvVar>>({
    key: '',
    value: '',
    description: '',
    category: 'custom',
    sensitive: false,
  });

  // New API integration form state
  const [newIntegration, setNewIntegration] = useState<Partial<ApiIntegration>>({
    id: '',
    name: '',
    type: 'azure_openai',
    endpoint: '',
    api_key: '',
    config: {},
    enabled: true,
  });

  // Load environment variables
  const loadEnvVars = useCallback(async () => {
    const response = await fetch(
      `/api/admin/env${selectedCategory ? `?category=${selectedCategory}` : ''}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load environment variables');
    }

    const data = await response.json();
    setEnvVars(data);
  }, [selectedCategory]);

  // Load API integrations
  const loadIntegrations = useCallback(async () => {
    const response = await fetch(
      `/api/admin/integrations${selectedIntegrationType ? `?type=${selectedIntegrationType}` : ''}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to load API integrations');
    }

    const data = await response.json();
    setIntegrations(data);
  }, [selectedIntegrationType]);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'env' || activeTab === 'all') {
        await loadEnvVars();
      }

      if (activeTab === 'integrations' || activeTab === 'all') {
        await loadIntegrations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading data');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while loading data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadEnvVars, loadIntegrations]);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save environment variable
  const saveEnvVar = async () => {
    try {
      if (!newEnv.key || !newEnv.value) {
        toast({
          title: 'Validation Error',
          description: 'Key and value are required',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/env', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEnv),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save environment variable');
      }

      toast({
        title: 'Success',
        description: `Environment variable ${newEnv.key} saved successfully`,
        variant: 'default',
      });

      // Reset form and reload data
      setNewEnv({
        key: '',
        value: '',
        description: '',
        category: 'custom',
        sensitive: false,
      });
      setShowEnvDialog(false);
      loadEnvVars();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while saving',
        variant: 'destructive',
      });
    }
  };

  // Delete environment variable
  const deleteEnvVar = async (key: string) => {
    if (!confirm(`Are you sure you want to delete ${key}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/env?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete environment variable');
      }

      toast({
        title: 'Success',
        description: `Environment variable ${key} deleted successfully`,
        variant: 'default',
      });

      // Reload data
      loadEnvVars();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while deleting',
        variant: 'destructive',
      });
    }
  };

  // Save API integration
  const saveIntegration = async () => {
    try {
      if (
        !newIntegration.id ||
        !newIntegration.name ||
        !newIntegration.endpoint ||
        !newIntegration.api_key
      ) {
        toast({
          title: 'Validation Error',
          description: 'ID, name, endpoint, and API key are required',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/integrations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newIntegration),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save API integration');
      }

      toast({
        title: 'Success',
        description: `API integration ${newIntegration.name} saved successfully`,
        variant: 'default',
      });

      // Reset form and reload data
      setNewIntegration({
        id: '',
        name: '',
        type: 'azure_openai',
        endpoint: '',
        api_key: '',
        config: {},
        enabled: true,
      });
      setShowIntegrationDialog(false);
      loadIntegrations();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while saving',
        variant: 'destructive',
      });
    }
  };

  // Delete API integration
  const deleteIntegration = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this integration?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/integrations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete API integration');
      }

      toast({
        title: 'Success',
        description: 'API integration deleted successfully',
        variant: 'default',
      });

      // Reload data
      loadIntegrations();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while deleting',
        variant: 'destructive',
      });
    }
  };

  // Test API integration
  const testIntegration = async (id: string) => {
    setTestingIntegration(id);

    try {
      const response = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test API integration');
      }

      const data = await response.json();

      setTestResults({
        ...testResults,
        [id]: data.testResult,
      });

      toast({
        title: data.testResult.success ? 'Test Successful' : 'Test Failed',
        description: data.testResult.success
          ? `Successfully connected to ${data.name}`
          : `Failed to connect to ${data.name}: ${data.testResult.error}`,
        variant: data.testResult.success ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while testing',
        variant: 'destructive',
      });

      setTestResults({
        ...testResults,
        [id]: {
          success: false,
          error: err instanceof Error ? err.message : 'An error occurred while testing',
        },
      });
    } finally {
      setTestingIntegration(null);
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    // Load data for the selected tab
    if (value === 'env') {
      loadEnvVars();
    } else if (value === 'integrations') {
      loadIntegrations();
    }
  };

  // Render category badge
  const renderCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      database: 'bg-blue-100 text-blue-800',
      azure: 'bg-purple-100 text-purple-800',
      auth: 'bg-green-100 text-green-800',
      security: 'bg-red-100 text-red-800',
      monitoring: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>{category}</Badge>
    );
  };

  // Render integration type badge
  const renderIntegrationTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      azure_openai: 'bg-blue-100 text-blue-800',
      azure_form_recognizer: 'bg-purple-100 text-purple-800',
      azure_search: 'bg-green-100 text-green-800',
      custom: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={typeColors[type] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  // Render test result badge
  const renderTestResultBadge = (id: string) => {
    const result = testResults[id];

    if (!result) {
      return null;
    }

    return result.success ? (
      <Badge className="bg-green-100 text-green-800">
        <Check className="w-3 h-3 mr-1" /> Success
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">
        <X className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Environment Configuration</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="env" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="env">Environment Variables</TabsTrigger>
          <TabsTrigger value="integrations">API Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <Select
                value={selectedCategory || ''}
                onValueChange={(value) => setSelectedCategory(value || null)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue>All Categories</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {Object.values(ConfigCategory).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={loadEnvVars} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>

            <Button onClick={() => setShowEnvDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        <p className="mt-2 text-sm text-gray-500">
                          Loading environment variables...
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : envVars.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-sm text-gray-500">No environment variables found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    envVars.map((env) => (
                      <TableRow key={env.key}>
                        <TableCell className="font-mono">{env.key}</TableCell>
                        <TableCell className="font-mono">
                          {env.sensitive ? '********' : env.value}
                        </TableCell>
                        <TableCell>{renderCategoryBadge(env.category)}</TableCell>
                        <TableCell>{env.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => deleteEnvVar(env.key)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Variable</DialogTitle>
                <DialogDescription>
                  Add a new environment variable to the application.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="key" className="text-right">
                    Key
                  </label>
                  <Input
                    id="key"
                    value={newEnv.key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewEnv({ ...newEnv, key: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="APP_SETTING_NAME"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="value" className="text-right">
                    Value
                  </label>
                  <Input
                    id="value"
                    value={newEnv.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewEnv({ ...newEnv, value: e.target.value })
                    }
                    className="col-span-3"
                    type={newEnv.sensitive ? 'password' : 'text'}
                    placeholder="Value"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="category" className="text-right">
                    Category
                  </label>
                  <Select
                    value={newEnv.category}
                    onValueChange={(value) => setNewEnv({ ...newEnv, category: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue>Select category</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ConfigCategory).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="description" className="text-right">
                    Description
                  </label>
                  <Textarea
                    id="description"
                    value={newEnv.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewEnv({ ...newEnv, description: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="Description"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="sensitive" className="text-right">
                    Sensitive
                  </label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="sensitive"
                      checked={newEnv.sensitive}
                      onCheckedChange={(checked) => setNewEnv({ ...newEnv, sensitive: checked })}
                    />
                    <label htmlFor="sensitive" className="text-sm text-gray-500">
                      Mask this value in the UI and encrypt in the database
                    </label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEnvDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEnvVar}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <Select
                value={selectedIntegrationType || ''}
                onValueChange={(value) => setSelectedIntegrationType(value || null)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue>All Types</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {Object.values(IntegrationType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={loadIntegrations} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>

            <Button onClick={() => setShowIntegrationDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        <p className="mt-2 text-sm text-gray-500">Loading API integrations...</p>
                      </TableCell>
                    </TableRow>
                  ) : integrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-sm text-gray-500">No API integrations found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    integrations.map((integration) => (
                      <TableRow key={integration.id}>
                        <TableCell>{integration.name}</TableCell>
                        <TableCell>{renderIntegrationTypeBadge(integration.type)}</TableCell>
                        <TableCell className="font-mono text-xs">{integration.endpoint}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={
                                integration.enabled
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {integration.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            {renderTestResultBadge(integration.id)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testIntegration(integration.id)}
                              disabled={testingIntegration === integration.id}
                            >
                              {testingIntegration === integration.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Test'
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteIntegration(integration.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={showIntegrationDialog} onOpenChange={setShowIntegrationDialog}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Add API Integration</DialogTitle>
                <DialogDescription>Add a new API integration to the application.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="id" className="text-right">
                    ID
                  </label>
                  <Input
                    id="id"
                    value={newIntegration.id}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewIntegration({ ...newIntegration, id: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="unique-integration-id"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="name" className="text-right">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={newIntegration.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewIntegration({ ...newIntegration, name: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="Integration Name"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="type" className="text-right">
                    Type
                  </label>
                  <Select
                    value={newIntegration.type}
                    onValueChange={(value) => setNewIntegration({ ...newIntegration, type: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue>Select type</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(IntegrationType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="endpoint" className="text-right">
                    Endpoint
                  </label>
                  <Input
                    id="endpoint"
                    value={newIntegration.endpoint}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewIntegration({ ...newIntegration, endpoint: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="https://api.example.com"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="api_key" className="text-right">
                    API Key
                  </label>
                  <Input
                    id="api_key"
                    value={newIntegration.api_key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewIntegration({ ...newIntegration, api_key: e.target.value })
                    }
                    className="col-span-3"
                    type="password"
                    placeholder="API Key"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="config" className="text-right">
                    Config (JSON)
                  </label>
                  <Textarea
                    id="config"
                    value={JSON.stringify(newIntegration.config, null, 2)}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      try {
                        const config = JSON.parse(e.target.value);
                        setNewIntegration({ ...newIntegration, config });
                      } catch {
                        // Allow invalid JSON during editing
                      }
                    }}
                    className="col-span-3 font-mono"
                    placeholder="{}"
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="enabled" className="text-right">
                    Enabled
                  </label>
                  <div className="flex items-center space-x-2 col-span-3">
                    <Switch
                      id="enabled"
                      checked={newIntegration.enabled}
                      onCheckedChange={(checked) =>
                        setNewIntegration({ ...newIntegration, enabled: checked })
                      }
                    />
                    <label htmlFor="enabled" className="text-sm text-gray-500">
                      Enable this integration
                    </label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowIntegrationDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveIntegration}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
