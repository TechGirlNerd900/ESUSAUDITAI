import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2, Plus, Trash2, RefreshCw, Check, X } from 'lucide-react';
import { IntegrationType } from '@/lib/configManager';
import { useIntegrations } from '@/hooks/useIntegrations';
import { IntegrationForm } from './IntegrationForm';

export const IntegrationsTab: React.FC = () => {
  const {
    integrations,
    loading,
    error,
    testingIntegration,
    testResults,
    loadIntegrations,
    saveIntegration,
    deleteIntegration,
    testIntegration,
  } = useIntegrations();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations(selectedType || undefined);
  }, [selectedType, loadIntegrations]);

  // Handle type change
  const handleTypeChange = (value: string) => {
    const type = value || null;
    setSelectedType(type);
    loadIntegrations(type || undefined);
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
        {type.replace('_', ' ').toUpperCase()}
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
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Select value={selectedType || ''} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {Object.values(IntegrationType).map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace('_', ' ').toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => loadIntegrations(selectedType || undefined)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* API Integrations Table */}
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
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-red-500">Error: {error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadIntegrations(selectedType || undefined)}
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ) : integrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-sm text-gray-500">
                      No API integrations found
                      {selectedType && ` of type "${selectedType}"`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Click &quot;Add Integration&quot; to create your first integration for this
                      organization
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">{integration.name}</TableCell>
                    <TableCell>{renderIntegrationTypeBadge(integration.type)}</TableCell>
                    <TableCell
                      className="font-mono text-xs max-w-xs truncate"
                      title={integration.endpoint}
                    >
                      {integration.endpoint}
                    </TableCell>
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

      {/* Add Integration Dialog */}
      <IntegrationForm open={showDialog} onOpenChange={setShowDialog} onSave={saveIntegration} />
    </div>
  );
};
